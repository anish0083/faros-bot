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

  const guildId = process.env.GUILD_ID;

  try {
    if (guildId) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
        { body: commands },
      );
      console.log(`Registered ${commands.length} command(s) to guild ${guildId}. They appear immediately.`);
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );
      console.log(`Registered ${commands.length} global command(s). These can take up to an hour to appear.`);
      console.log('Set GUILD_ID in your .env to register to one server instead, which updates immediately.');
    }
  } catch (error) {
    console.error('Error registering commands:', error);
    process.exit(1);
  }
})();
