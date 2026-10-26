const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('node:crypto');
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

function healthPayload() {
  return JSON.stringify({
    ok: true,
    discord: Boolean(client.isReady()),
    db: Boolean(client.dbReady),
    user: client.user?.tag || null,
  });
}

function verifyDiscordSignature(rawBody, signatureHex, timestamp, publicKeyHex) {
  try {
    const key = crypto.createPublicKey({
      key: Buffer.concat([
        Buffer.from('302a300506032b6570032100', 'hex'),
        Buffer.from(publicKeyHex, 'hex'),
      ]),
      format: 'der',
      type: 'spki',
    });
    return crypto.verify(null, Buffer.from(`${timestamp}${rawBody}`), key, Buffer.from(signatureHex, 'hex'));
  } catch (error) {
    console.error('[Discord HTTP] Signature verify failed:', error.message);
    return false;
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];

  if (req.method === 'POST') {
    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];
    const publicKey = (process.env.DISCORD_PUBLIC_KEY || '').trim();

    readRequestBody(req).then(raw => {
      if (!signature || !timestamp) {
        res.writeHead(404);
        res.end();
        return;
      }
      if (!publicKey) {
        console.error('[Discord HTTP] Got an interaction POST but DISCORD_PUBLIC_KEY is not set. Clear Interactions Endpoint URL in the Discord Developer Portal, or set DISCORD_PUBLIC_KEY.');
        res.writeHead(401);
        res.end();
        return;
      }
      if (!verifyDiscordSignature(raw.toString('utf8'), signature, timestamp, publicKey)) {
        res.writeHead(401);
        res.end();
        return;
      }

      const body = JSON.parse(raw.toString('utf8'));
      if (body.type === 1) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ type: 1 }));
        return;
      }

      console.log(`[Discord HTTP] Interaction type=${body.type} command=${body.data?.name || body.data?.custom_id || 'n/a'}`);
      if (client.actions?.InteractionCreate) {
        client.actions.InteractionCreate.handle(body);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ type: 5, data: { flags: 64 } }));
    }).catch(error => {
      console.error('[Discord HTTP]', error.message);
      res.writeHead(500);
      res.end();
    });
    return;
  }

  const payload = healthPayload();
  if (url === '/health') {
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
