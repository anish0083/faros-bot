const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { getGuildRole } = require('../utils/database');
const { CHAIN, NFT, chainFooter } = require('../config/chain');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setupnft')
    .setDescription('Post the NFT role claim embed in this channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const config = await getGuildRole(interaction.guildId);
    if (!config) {
      await interaction.editReply({ content: '❌ This server is not configured yet. Run `/config role:@YourRole` first.' });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎫 NFT Holder Role')
      .setDescription(
        'Click the button below and submit your wallet address.\n\n' +
        `If your address holds **${NFT.name}** on **${CHAIN.name}**, ` +
        `you will be granted the <@&${config.role_id}> role.\n\n` +
        '**Rules:**\n' +
        '• One claim per Discord account\n' +
        '• Address format: `0x` + 40 hex characters'
      )
      .setColor(0xFF4500)
      .setFooter({ text: chainFooter() })
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId('claim_role_button')
      .setLabel('Claim Role')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🎫');

    await interaction.channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(button)],
    });

    await interaction.editReply({ content: '✅ Claim embed posted!' });
  },
};
