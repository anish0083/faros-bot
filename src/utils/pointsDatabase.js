const { Pool } = require('pg');
const { randomUUID } = require('crypto');

let pool;

async function initializePointsDatabase() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });
    pool.on('error', err => console.error('[Points DB] Idle client error:', err.message));
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pt_config (
      guild_id    TEXT PRIMARY KEY,
      mod_role_id TEXT NOT NULL,
      configured_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS pt_points (
      guild_id        TEXT NOT NULL,
      discord_user_id TEXT NOT NULL,
      points          INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, discord_user_id)
    );

    CREATE TABLE IF NOT EXISTS pt_transactions (
      id             SERIAL PRIMARY KEY,
      guild_id       TEXT NOT NULL,
      discord_user_id TEXT NOT NULL,
      mod_discord_id TEXT NOT NULL,
      delta          INTEGER NOT NULL,
      reason         TEXT NOT NULL,
      created_at     TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS pt_pending (
      id         TEXT PRIMARY KEY,
      guild_id   TEXT NOT NULL,
      mod_id     TEXT NOT NULL,
      user_ids   TEXT NOT NULL,
      delta      INTEGER NOT NULL,
      reason     TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  console.log('[Points DB] Tables initialized');
}

async function getPtConfig(guildId) {
  const { rows } = await pool.query('SELECT * FROM pt_config WHERE guild_id = $1', [guildId]);
  return rows[0] || null;
}

async function setPtConfig(guildId, modRoleId) {
  await pool.query(`
    INSERT INTO pt_config (guild_id, mod_role_id)
    VALUES ($1, $2)
    ON CONFLICT (guild_id) DO UPDATE SET
      mod_role_id   = EXCLUDED.mod_role_id,
      configured_at = NOW()
  `, [guildId, modRoleId]);
}

async function createPtPending(guildId, modId, userIds, delta) {
  const id = randomUUID();
  await pool.query(`
    INSERT INTO pt_pending (id, guild_id, mod_id, user_ids, delta)
    VALUES ($1, $2, $3, $4, $5)
  `, [id, guildId, modId, userIds.join(','), delta]);
  return id;
}

async function getPtPending(id) {
  // Clean up expired entries (> 10 min old) first
  await pool.query(`DELETE FROM pt_pending WHERE created_at < NOW() - INTERVAL '10 minutes'`);
  const { rows } = await pool.query('SELECT * FROM pt_pending WHERE id = $1', [id]);
  return rows[0] || null;
}

async function setPtPendingReason(id, reason) {
  await pool.query('UPDATE pt_pending SET reason = $1 WHERE id = $2', [reason, id]);
}

async function deletePtPending(id) {
  await pool.query('DELETE FROM pt_pending WHERE id = $1', [id]);
}

async function applyPoints(guildId, modId, userIds, delta, reason) {
  for (const userId of userIds) {
    await pool.query(`
      INSERT INTO pt_points (guild_id, discord_user_id, points)
      VALUES ($1, $2, GREATEST(0, $3))
      ON CONFLICT (guild_id, discord_user_id) DO UPDATE SET
        points = GREATEST(0, pt_points.points + $3)
    `, [guildId, userId, delta]);

    await pool.query(`
      INSERT INTO pt_transactions (guild_id, discord_user_id, mod_discord_id, delta, reason)
      VALUES ($1, $2, $3, $4, $5)
    `, [guildId, userId, modId, delta, reason]);
  }
}

async function getUserPoints(guildId, userId) {
  const { rows } = await pool.query(
    'SELECT points FROM pt_points WHERE guild_id = $1 AND discord_user_id = $2',
    [guildId, userId]
  );
  return rows[0]?.points ?? 0;
}

async function getLeaderboard(guildId, limit = 10) {
  const { rows } = await pool.query(`
    SELECT discord_user_id, points
    FROM pt_points
    WHERE guild_id = $1 AND points > 0
    ORDER BY points DESC
    LIMIT $2
  `, [guildId, limit]);
  return rows;
}

async function getModStats(guildId, limit = 10) {
  const { rows } = await pool.query(`
    SELECT
      mod_discord_id,
      SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END)  AS total_distributed,
      SUM(CASE WHEN delta < 0 THEN ABS(delta) ELSE 0 END) AS total_removed
    FROM pt_transactions
    WHERE guild_id = $1
    GROUP BY mod_discord_id
    ORDER BY total_distributed DESC
    LIMIT $2
  `, [guildId, limit]);
  return rows;
}

module.exports = {
  initializePointsDatabase,
  getPtConfig, setPtConfig,
  createPtPending, getPtPending, setPtPendingReason, deletePtPending,
  applyPoints, getUserPoints,
  getLeaderboard, getModStats,
};
