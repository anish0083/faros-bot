const { Pool } = require('pg');
const dns = require('dns').promises;

let pool;

async function createPool() {
  const dbUrl = new URL(process.env.DATABASE_URL);
  const { address } = await dns.lookup(dbUrl.hostname, { family: 4 });
  pool = new Pool({
    host: address,
    port: parseInt(dbUrl.port) || 5432,
    database: dbUrl.pathname.slice(1),
    user: dbUrl.username,
    password: decodeURIComponent(dbUrl.password),
    ssl: { rejectUnauthorized: false },
  });
}

async function initializeDatabase() {
  await createPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id      TEXT PRIMARY KEY,
      role_id       TEXT NOT NULL,
      configured_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS nft_claims (
      guild_id         TEXT NOT NULL,
      discord_user_id  TEXT NOT NULL,
      wallet_address   TEXT NOT NULL,
      contract_address TEXT NOT NULL,
      claimed_at       TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (guild_id, discord_user_id)
    );

    CREATE INDEX IF NOT EXISTS nft_claims_wallet_idx
      ON nft_claims (guild_id, LOWER(wallet_address));
  `);
  console.log('[Database] PostgreSQL initialized');
}

async function getGuildRole(guildId) {
  const { rows } = await pool.query('SELECT * FROM guild_settings WHERE guild_id = $1', [guildId]);
  return rows[0] || null;
}

async function setGuildRole(guildId, roleId) {
  await pool.query(`
    INSERT INTO guild_settings (guild_id, role_id)
    VALUES ($1, $2)
    ON CONFLICT (guild_id) DO UPDATE SET
      role_id       = EXCLUDED.role_id,
      configured_at = NOW()
  `, [guildId, roleId]);
}

async function hasUserClaimed(guildId, discordUserId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM nft_claims WHERE guild_id = $1 AND discord_user_id = $2',
    [guildId, discordUserId]
  );
  return rows.length > 0;
}

async function recordClaim(guildId, discordUserId, walletAddress, contractAddress) {
  await pool.query(`
    INSERT INTO nft_claims (guild_id, discord_user_id, wallet_address, contract_address)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (guild_id, discord_user_id) DO UPDATE SET
      wallet_address   = EXCLUDED.wallet_address,
      contract_address = EXCLUDED.contract_address,
      claimed_at       = NOW()
  `, [guildId, discordUserId, walletAddress, contractAddress]);
}

module.exports = { initializeDatabase, getGuildRole, setGuildRole, hasUserClaimed, recordClaim };
