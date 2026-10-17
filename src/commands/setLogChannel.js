const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } = require('discord.js');
const { getPtConfig, setLogChannel } = require('../utils/pointsDatabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-log-channel')
    .setDescription('Set the channel where points activity logs are sent.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('The text channel to send logs to.')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Only administrators can use this command.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const config = await getPtConfig(interaction.guildId);
    if (!config) {
      await interaction.editReply({ content: '❌ Run `/pt-config` first to set up the points system.' });
      return;
    }

    const channel = interaction.options.getChannel('channel');
    await setLogChannel(interaction.guildId, channel.id);

    await interaction.editReply({
      content: `✅ Log channel set to <#${channel.id}>.\nAll point activity will be logged there.`,
    });
  },
};
