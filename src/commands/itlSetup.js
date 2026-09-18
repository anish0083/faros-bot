const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { getItlGuildSettings } = require('../utils/itlDatabase');
const { CHAIN, chainFooter } = require('../config/chain');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('itl-setup')
    .setDescription('Post the ITL wallet verification embed in this channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const settings = await getItlGuildSettings(interaction.guildId);
    if (!settings) {
      await interaction.editReply({ content: '❌ Not configured yet. Run `/itl-config role:@Role payment_wallet:0x...` first.' });
      return;
    }

    const collectionLine = settings.collection_name
      ? `**Collection:** ${settings.collection_name}\n`
      : '';

    const embed = new EmbedBuilder()
      .setTitle('🔗 Wallet Verification')
      .setDescription(
        `${collectionLine}` +
        `Verify your **${CHAIN.name}** wallet to receive the <@&${settings.role_id}> role.\n\n` +
        '**How it works:**\n' +
        '1. Click **Verify Wallet** below\n' +
        '2. Enter your wallet address\n' +
        '3. Send any small transaction from that wallet to the shown address\n' +
        '4. Your role will be granted automatically\n\n' +
        '• One verification per Discord account\n' +
        '• You have **15 minutes** to complete the transaction'
      )
      .setColor(0x5865F2)
      .setFooter({ text: chainFooter() })
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId('itl_claim_button')
      .setLabel('Verify Wallet')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔗');

    await interaction.channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(button)],
    });

    await interaction.editReply({ content: '✅ Verification embed posted!' });
  },
};
