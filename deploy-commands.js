require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];

const commandsPath = path.join(__dirname, 'src', 'commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if (command.data) {
    commands.push(command.data.toJSON());
    console.log(`Prepared command: ${command.data.name}`);
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    console.error('DISCORD_TOKEN and CLIENT_ID must both be set.');
    process.exit(1);
  }

  const guildIds = (process.env.GUILD_ID || '')
    .split(/[\s,]+/)
    .map(id => id.trim())
    .filter(Boolean);

  const malformed = guildIds.filter(id => !/^\d{17,20}$/.test(id));
  if (malformed.length) {
    console.error(`GUILD_ID contains values that are not server IDs: ${malformed.join(', ')}`);
    process.exit(1);
  }

  if (!guildIds.length) {
    try {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );
      console.log(`Registered ${commands.length} global command(s). These can take up to an hour to appear.`);
      console.log('Set GUILD_ID in your .env to register to specific servers instead, which updates immediately.');
    } catch (error) {
      console.error('Error registering global commands:', error);
      process.exit(1);
    }
    return;
  }

  let failed = 0;

  for (const guildId of guildIds) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
        { body: commands },
      );
      console.log(`Registered ${commands.length} command(s) to guild ${guildId}. They appear immediately.`);
    } catch (error) {
      failed++;
      if (error.status === 403) {
        console.error(`Guild ${guildId}: missing access. Invite the bot to that server with the applications.commands scope first.`);
      } else if (error.status === 404) {
        console.error(`Guild ${guildId}: not found. Check the server ID.`);
      } else {
        console.error(`Guild ${guildId}: ${error.message}`);
      }
    }
  }

  if (failed) process.exit(1);
})();
