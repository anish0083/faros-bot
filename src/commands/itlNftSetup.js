const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { getItlNftConfigs } = require('../utils/itlDatabase');
const { CHAIN, chainFooter } = require('../config/chain');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('itl-nft-setup')
    .setDescription('Post the ITL NFT holder claim embed in this channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const configs = await getItlNftConfigs(interaction.guildId);
    if (!configs.length) {
      await interaction.editReply({ content: '❌ No NFT collections configured yet. Run `/itl-nft-config` first.' });
      return;
    }

    const collectionList = configs
      .map(c => `• **${c.collection_name}** → <@&${c.role_id}>`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🎫 NFT Holder Verification')
      .setDescription(
        `Hold any of the following NFTs on **${CHAIN.name}** to receive your role:\n\n` +
        `${collectionList}\n\n` +
        '**How to claim:**\n' +
        '1. Click **Claim Role** below\n' +
        '2. Submit your wallet address\n' +
        '3. Bot instantly verifies your balance and assigns your role\n\n' +
        '• One claim per Discord account per collection'
      )
      .setColor(0xFF4500)
      .setFooter({ text: chainFooter() })
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId('itl_nft_claim_button')
      .setLabel('Claim Role')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🎫');

    await interaction.channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(button)],
    });

    await interaction.editReply({ content: '✅ NFT claim embed posted!' });
  },
};
