const { Pool } = require('pg');

let pool;

async function createPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  pool.on('error', error => console.error('[ITL Database] Idle client error:', error.message));

  const client = await pool.connect();
  client.release();
}

async function initializeItlDatabase() {
  await createPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS itl_guild_settings (
      guild_id         TEXT PRIMARY KEY,
      role_id          TEXT NOT NULL,
      payment_wallet   TEXT NOT NULL,
      collection_name  TEXT NOT NULL DEFAULT '',
      contract_address TEXT NOT NULL DEFAULT '',
      token_id         TEXT,
      nft_explorer_url TEXT,
      configured_at    TIMESTAMP NOT NULL DEFAULT NOW()
    );

    ALTER TABLE itl_guild_settings ADD COLUMN IF NOT EXISTS collection_name  TEXT NOT NULL DEFAULT '';
    ALTER TABLE itl_guild_settings ADD COLUMN IF NOT EXISTS contract_address TEXT NOT NULL DEFAULT '';
    ALTER TABLE itl_guild_settings ADD COLUMN IF NOT EXISTS token_id         TEXT;
    ALTER TABLE itl_guild_settings ADD COLUMN IF NOT EXISTS nft_explorer_url TEXT;

    CREATE TABLE IF NOT EXISTS itl_pending_claims (
      id              SERIAL PRIMARY KEY,
      guild_id        TEXT NOT NULL,
      discord_user_id TEXT NOT NULL,
      wallet_address  TEXT NOT NULL,
      display_amount  TEXT NOT NULL,
      payment_wallet  TEXT NOT NULL,
      role_id         TEXT NOT NULL,
      created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at      TIMESTAMP NOT NULL,
      UNIQUE (guild_id, discord_user_id)
    );

    CREATE TABLE IF NOT EXISTS itl_claims (
      guild_id        TEXT NOT NULL,
      discord_user_id TEXT NOT NULL,
      wallet_address  TEXT NOT NULL,
      claimed_at      TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (guild_id, discord_user_id)
    );

    CREATE TABLE IF NOT EXISTS itl_user_strikes (
      guild_id        TEXT NOT NULL,
      discord_user_id TEXT NOT NULL,
      strikes         INT NOT NULL DEFAULT 0,
      timeout_until   TIMESTAMP,
      PRIMARY KEY (guild_id, discord_user_id)
    );

  `);
  console.log('[ITL Database] Tables initialized');
}

async function getItlGuildSettings(guildId) {
  const { rows } = await pool.query('SELECT * FROM itl_guild_settings WHERE guild_id = $1', [guildId]);
  return rows[0] || null;
}

async function setItlGuildSettings(guildId, roleId, paymentWallet, collectionName, contractAddress, tokenId, nftExplorerUrl) {
  await pool.query(`
    INSERT INTO itl_guild_settings (guild_id, role_id, payment_wallet, collection_name, contract_address, token_id, nft_explorer_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (guild_id) DO UPDATE SET
      role_id          = EXCLUDED.role_id,
      payment_wallet   = EXCLUDED.payment_wallet,
      collection_name  = EXCLUDED.collection_name,
      contract_address = EXCLUDED.contract_address,
      token_id         = EXCLUDED.token_id,
      nft_explorer_url = EXCLUDED.nft_explorer_url,
      configured_at    = NOW()
  `, [guildId, roleId, paymentWallet, collectionName || '', contractAddress || '', tokenId || null, nftExplorerUrl || null]);
}

async function getActivePendingClaims() {
  const { rows } = await pool.query(
    'SELECT * FROM itl_pending_claims WHERE expires_at > NOW()'
  );
  return rows;
}

async function getPendingClaimByUser(guildId, discordUserId) {
  const { rows } = await pool.query(
    'SELECT * FROM itl_pending_claims WHERE guild_id = $1 AND discord_user_id = $2 AND expires_at > NOW()',
    [guildId, discordUserId]
  );
  return rows[0] || null;
}

async function createPendingClaim(guildId, discordUserId, walletAddress, displayAmount, paymentWallet, roleId, expiresAt) {
  await pool.query(`
    INSERT INTO itl_pending_claims (guild_id, discord_user_id, wallet_address, display_amount, payment_wallet, role_id, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (guild_id, discord_user_id) DO UPDATE SET
      wallet_address = EXCLUDED.wallet_address,
      display_amount = EXCLUDED.display_amount,
      payment_wallet = EXCLUDED.payment_wallet,
      role_id        = EXCLUDED.role_id,
      created_at     = NOW(),
      expires_at     = EXCLUDED.expires_at
  `, [guildId, discordUserId, walletAddress, displayAmount, paymentWallet, roleId, expiresAt]);
}

async function deletePendingClaim(id) {
  await pool.query('DELETE FROM itl_pending_claims WHERE id = $1', [id]);
}

async function popExpiredPendingClaims() {
  const { rows } = await pool.query(
    'DELETE FROM itl_pending_claims WHERE expires_at <= NOW() RETURNING *'
  );
  return rows;
}

async function hasUserItlClaimed(guildId, discordUserId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM itl_claims WHERE guild_id = $1 AND discord_user_id = $2',
    [guildId, discordUserId]
  );
  return rows.length > 0;
}

async function recordItlClaim(guildId, discordUserId, walletAddress) {
  await pool.query(`
    INSERT INTO itl_claims (guild_id, discord_user_id, wallet_address)
    VALUES ($1, $2, $3)
    ON CONFLICT (guild_id, discord_user_id) DO NOTHING
  `, [guildId, discordUserId, walletAddress]);
}

async function getStrikeInfo(guildId, discordUserId) {
  const { rows } = await pool.query(
    'SELECT * FROM itl_user_strikes WHERE guild_id = $1 AND discord_user_id = $2',
    [guildId, discordUserId]
  );
  return rows[0] || null;
}

async function incrementStrike(guildId, discordUserId) {
  const { rows } = await pool.query(`
    INSERT INTO itl_user_strikes (guild_id, discord_user_id, strikes)
    VALUES ($1, $2, 1)
    ON CONFLICT (guild_id, discord_user_id) DO UPDATE SET
      strikes = itl_user_strikes.strikes + 1
    RETURNING strikes
  `, [guildId, discordUserId]);
  return rows[0].strikes;
}

async function setUserTimeout(guildId, discordUserId, until) {
  await pool.query(`
    INSERT INTO itl_user_strikes (guild_id, discord_user_id, strikes, timeout_until)
    VALUES ($1, $2, 5, $3)
    ON CONFLICT (guild_id, discord_user_id) DO UPDATE SET
      timeout_until = EXCLUDED.timeout_until
  `, [guildId, discordUserId, until]);
}

module.exports = {
  initializeItlDatabase,
  getItlGuildSettings, setItlGuildSettings,
  getActivePendingClaims, getPendingClaimByUser, createPendingClaim,
  deletePendingClaim, popExpiredPendingClaims,
  hasUserItlClaimed, recordItlClaim,
  getStrikeInfo, incrementStrike, setUserTimeout,
};
