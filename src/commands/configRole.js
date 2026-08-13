const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { buildRoleSelect } = require('../utils/roleSetup');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config-role')
    .setDescription('Pick the role that verified NFT holders receive.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.reply({
      content: '**Choose the role** that verified holders should receive:',
      components: [buildRoleSelect()],
      flags: MessageFlags.Ephemeral,
    });
  },
};
