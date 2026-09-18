const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { ethers } = require('ethers');
const { setItlGuildSettings } = require('../utils/itlDatabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('itl-config')
    .setDescription('Configure the ITL wallet verification system for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt
        .setName('collection_name')
        .setDescription('Name of the NFT collection this verification is for.')
        .setRequired(true)
    )
    .addRoleOption(opt =>
      opt
        .setName('role')
        .setDescription('Role to grant after successful wallet verification.')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('payment_wallet')
        .setDescription('Wallet address that receives verification transactions.')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const collectionName = interaction.options.getString('collection_name').trim();
    const role           = interaction.options.getRole('role');
    const walletInput    = interaction.options.getString('payment_wallet').trim();

    if (!/^0x[0-9a-fA-F]{40}$/.test(walletInput)) {
      await interaction.editReply({ content: '❌ Invalid payment wallet address format. Must be `0x` + 40 hex characters.' });
      return;
    }

    let paymentWallet;
    try {
      paymentWallet = ethers.getAddress(walletInput);
    } catch {
      paymentWallet = walletInput.toLowerCase();
    }

    await setItlGuildSettings(interaction.guildId, role.id, paymentWallet, collectionName);

    await interaction.editReply({
      content:
        `✅ **ITL verification configured!**\n\n` +
        `**Collection:** ${collectionName}\n` +
        `**Role:** <@&${role.id}>\n` +
        `**Payment wallet:** \`${paymentWallet}\`\n\n` +
        `Run \`/itl-setup\` in a channel to post the verification embed.`,
    });
  },
};
