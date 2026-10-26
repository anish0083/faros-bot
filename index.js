require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { initializeDatabase } = require('./src/utils/database');
const { validateChainConfig, CHAIN, NFT } = require('./src/config/chain');
const { verifyChainConnection } = require('./src/utils/blockchain');
const { startItlPoller } = require('./src/utils/itlPoller');
const { initializeItlDatabase } = require('./src/utils/itlDatabase');
const { initializePointsDatabase } = require('./src/utils/pointsDatabase');

if (process.env.DISCORD_TOKEN) {
  process.env.DISCORD_TOKEN = process.env.DISCORD_TOKEN.replace(/^Bot\s+/i, '').trim();
}
if (process.env.CLIENT_ID) {
  process.env.CLIENT_ID = process.env.CLIENT_ID.trim();
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const server = http.createServer((req, res) => {
  const payload = JSON.stringify({
    ok: true,
    discord: Boolean(client.isReady()),
    db: Boolean(client.dbReady),
    user: client.user?.tag || null,
  });

  if (req.url === '/health') {
    res.writeHead(client.isReady() ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(payload);
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(payload);
});
server.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log(`[Server] Keep-alive server running on port ${process.env.PORT || 3000}`);
});

client.commands = new Collection();
client.dbReady = false;

const commandsPath = path.join(__dirname, 'src', 'commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`Loaded command: ${command.data.name}`);
  }
}

const eventsPath = path.join(__dirname, 'src', 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
  console.log(`Loaded event: ${event.name}`);
}

function guildIdsFromEnv() {
  return (process.env.GUILD_ID || '')
    .split(/[\s,]+/)
    .map(id => id.trim())
    .filter(id => /^\d{17,20}$/.test(id));
}

async function registerSlashCommands() {
  const payload = [...client.commands.values()].map(command => command.data.toJSON());
  const guildIds = guildIdsFromEnv();

  if (guildIds.length) {
    for (const guildId of guildIds) {
      await client.application.commands.set(payload, guildId);
      console.log(`[Discord] Registered ${payload.length} guild command(s) to ${guildId}`);
    }
    return;
  }

  await client.application.commands.set(payload);
  console.log(`[Discord] Registered ${payload.length} global command(s)`);
}

client.once('ready', () => {
  console.log(`[Discord] Logged in as ${client.user.tag} | guilds: ${client.guilds.cache.size}`);
  startItlPoller(client);
  registerSlashCommands().catch(error => {
    console.error('[Discord] Command registration failed:', error.message);
  });
});

client.on('warn', message => console.warn('[Discord Warn]', message));
client.on('error', error => console.error('[Discord Error]', error.message));
client.on('shardDisconnect', (event, shardId) => {
  console.error(`[Discord] Shard ${shardId} disconnected`, event?.code, event?.reason || '');
});
client.on('shardReconnecting', shardId => {
  console.log(`[Discord] Shard ${shardId} reconnecting...`);
});
client.on('shardResume', shardId => {
  console.log(`[Discord] Shard ${shardId} resumed`);
});

(async () => {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error('DISCORD_TOKEN is not set');
  }

  validateChainConfig();
  console.log(`[Config] Chain: ${CHAIN.name} | Collection: ${NFT.name} | Contract: ${NFT.address}`);

  console.log('[Discord] Testing token via REST...');
  try {
    const r = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    });
    const body = await r.json();
    console.log(`[Discord] Token test: HTTP ${r.status} | user: ${body.username ?? body.message}`);
    if (!r.ok) {
      throw new Error(`Discord token rejected: HTTP ${r.status} ${body.message || ''}`.trim());
    }
  } catch (e) {
    console.error('[Discord] Token test failed:', e.message);
    throw e;
  }

  console.log('[Discord] Calling client.login()...');
  await client.login(process.env.DISCORD_TOKEN);
  console.log('[Discord] client.login() resolved');

  await initializeDatabase();
  await initializeItlDatabase();
  await initializePointsDatabase();
  client.dbReady = true;
  console.log('[Database] Ready to handle commands');

  verifyChainConnection().catch(error => {
    console.error('[Chain] Verification failed (non-fatal):', error.message);
  });
})().catch(err => {
  console.error('Startup error:', err.message);
  process.exit(1);
});
