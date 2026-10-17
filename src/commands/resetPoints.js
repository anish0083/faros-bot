const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset-points')
    .setDescription('⚠️ Reset ALL points and history to zero. Cannot be undone.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Only administrators can use this command.', flags: MessageFlags.Ephemeral });
      return;
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('pt_reset_confirm')
        .setLabel('Yes, Reset Everything')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('pt_reset_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({
      content:
        '⚠️ **Are you sure?**\n\n' +
        'This will permanently delete **all points and transaction history** for this server.\n' +
        '**This cannot be undone.**',
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  },
};
