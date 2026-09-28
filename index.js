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

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is alive!');
});
server.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log(`[Server] Keep-alive server running on port ${process.env.PORT || 3000}`);
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

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

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  startItlPoller(client);
});

client.on('error', (error) => {
  console.error('[Discord Error]', error.message);
});

(async () => {
  validateChainConfig();
  console.log(`[Config] Chain: ${CHAIN.name} | Collection: ${NFT.name} | Contract: ${NFT.address}`);

  await initializeDatabase();
  await initializeItlDatabase();
  await verifyChainConnection();
  console.log('[Discord] Testing token via REST...');
  try {
    const r = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    });
    const body = await r.json();
    console.log(`[Discord] Token test: HTTP ${r.status} | user: ${body.username ?? body.message}`);
  } catch (e) {
    console.error('[Discord] Token test failed:', e.message);
  }
  console.log('[Discord] Calling client.login()...');
  await client.login(process.env.DISCORD_TOKEN);
  console.log('[Discord] client.login() resolved');
})().catch(err => {
  console.error('Startup error:', err.message);
  process.exit(1);
});
