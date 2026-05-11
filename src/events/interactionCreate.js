const { MessageFlags } = require('discord.js');
const handleClaimButton  = require('../handlers/claimButton');
const handleClaimModal   = require('../handlers/claimModal');
const handleConfigButton = require('../handlers/configButton');
const handleConfigModal  = require('../handlers/configModal');

module.exports = {
  name: 'interactionCreate',
  once: false,

  async execute(interaction, client) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
          await interaction.reply({ content: 'Unknown command.', flags: MessageFlags.Ephemeral });
          return;
        }
        await command.execute(interaction);
        return;
      }

      if (interaction.isButton()) {
        if (interaction.customId === 'claim_role_button')  await handleClaimButton(interaction);
        if (interaction.customId === 'config_open_modal')  await handleConfigButton(interaction);
        return;
      }

      if (interaction.isModalSubmit()) {
        if (interaction.customId === 'claim_role_modal')    await handleClaimModal(interaction);
        if (interaction.customId === 'server_config_modal') await handleConfigModal(interaction);
        return;
      }
    } catch (error) {
      console.error('[InteractionCreate]', error);
      try {
        const msg = { content: '❌ Something went wrong. Please try again.', flags: MessageFlags.Ephemeral };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg);
        } else {
          await interaction.reply(msg);
        }
      } catch {
        // interaction already expired — nothing to do
      }
    }
  },
};
