require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { initializeDatabase } = require('./src/utils/database');

// Keep-alive server for Render free tier
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is alive!');
});
server.listen(process.env.PORT || 3000);

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

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('error', (error) => {
  console.error('[Discord Error]', error.message);
});

(async () => {
  await initializeDatabase();
  await client.login(process.env.DISCORD_TOKEN);
})().catch(err => {
  console.error('Startup error:', err.message);
  process.exit(1);
});
