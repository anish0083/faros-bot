const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS server_configs (
      guild_id             TEXT PRIMARY KEY,
      nft_contract_address TEXT NOT NULL,
      rpc_url              TEXT NOT NULL,
      role_id              TEXT NOT NULL,
      configured_at        TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS used_tokens (
      id              SERIAL PRIMARY KEY,
      guild_id        TEXT NOT NULL,
      token_id        TEXT NOT NULL,
      discord_user_id TEXT NOT NULL,
      eth_address     TEXT NOT NULL,
      claimed_at      TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(guild_id, token_id)
    );

    CREATE TABLE IF NOT EXISTS claimed_users (
      guild_id        TEXT NOT NULL,
      discord_user_id TEXT NOT NULL,
      eth_address     TEXT NOT NULL,
      token_id        TEXT NOT NULL,
      claimed_at      TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (guild_id, discord_user_id)
    );
  `);
  console.log('[Database] PostgreSQL initialized');
}

async function getServerConfig(guildId) {
  const { rows } = await pool.query('SELECT * FROM server_configs WHERE guild_id = $1', [guildId]);
  return rows[0] || null;
}

async function setServerConfig(guildId, nftContractAddress, rpcUrl, roleId) {
  await pool.query(`
    INSERT INTO server_configs (guild_id, nft_contract_address, rpc_url, role_id)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (guild_id) DO UPDATE SET
      nft_contract_address = EXCLUDED.nft_contract_address,
      rpc_url              = EXCLUDED.rpc_url,
      role_id              = EXCLUDED.role_id,
      configured_at        = NOW()
  `, [guildId, nftContractAddress, rpcUrl, roleId]);
}

async function isTokenUsed(guildId, tokenId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM used_tokens WHERE guild_id = $1 AND token_id = $2',
    [guildId, tokenId]
  );
  return rows.length > 0;
}

async function hasUserClaimed(guildId, discordUserId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM claimed_users WHERE guild_id = $1 AND discord_user_id = $2',
    [guildId, discordUserId]
  );
  return rows.length > 0;
}

async function markTokenUsed(guildId, tokenId, discordUserId, ethAddress) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO used_tokens (guild_id, token_id, discord_user_id, eth_address) VALUES ($1, $2, $3, $4)',
      [guildId, tokenId, discordUserId, ethAddress]
    );
    await client.query(
      'INSERT INTO claimed_users (guild_id, discord_user_id, eth_address, token_id) VALUES ($1, $2, $3, $4)',
      [guildId, discordUserId, ethAddress, tokenId]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { initializeDatabase, getServerConfig, setServerConfig, isTokenUsed, hasUserClaimed, markTokenUsed };
