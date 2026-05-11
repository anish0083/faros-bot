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
    .setName('config')
    .setDescription('Configure Faros Bot for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Defer first — DB query happens after
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const config = await getServerConfig(interaction.guildId);

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Faros Bot — Server Configuration')
      .setColor(config ? 0x00C853 : 0xFF4500)
      .setFooter({ text: `Server ID: ${interaction.guildId}` });

    if (config) {
      embed.setDescription(
        '✅ **This server is already configured.**\n\n' +
        `**NFT Contract:** \`${config.nft_contract_address}\`\n` +
        `**RPC URL:** \`${config.rpc_url}\`\n` +
        `**Role:** <@&${config.role_id}>\n` +
        `**Last configured:** ${new Date(config.configured_at).toUTCString()}\n\n` +
        'Click **Reconfigure** to update the settings.'
      );
    } else {
      embed.setDescription(
        '❌ **This server is not configured yet.**\n\n' +
        'Click **Configure** below to set up the bot.\n\n' +
        'You will need:\n' +
        '• NFT Contract Address on LitVM testnet\n' +
        '• RPC URL (LitVM default is pre-filled)\n' +
        '• Role ID to grant to verified NFT holders'
      );
    }

    const button = new ButtonBuilder()
      .setCustomId('config_open_modal')
      .setLabel(config ? 'Reconfigure' : 'Configure')
      .setStyle(config ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setEmoji('⚙️');

    await interaction.editReply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(button)],
    });
  },
};
