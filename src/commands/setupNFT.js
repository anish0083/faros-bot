const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { getServerConfig } = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setupnft')
    .setDescription('Post the NFT role claim embed in this channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Defer first — DB query happens after
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const config = await getServerConfig(interaction.guildId);
    if (!config) {
      await interaction.editReply({ content: '❌ This server is not configured yet. Run `/config` first.' });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎫 NFT Holder Role')
      .setDescription(
        'Click the button below and submit your wallet address.\n\n' +
        'If your address holds **Beacon Pass** on the LitVM LiteForge testnet, ' +
        'you will be granted the <@&' + config.role_id + '> role.\n\n' +
        '**Rules:**\n' +
        '• Each token ID can only be used once across all wallets\n' +
        '• Address format: `0x` + 40 hex characters'
      )
      .setColor(0xFF4500)
      .setFooter({ text: 'LitVM LiteForge Testnet • Chain ID: 4441' })
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
