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
        .setDescription('Display name of the NFT collection.')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('contract')
        .setDescription('NFT contract address to verify ownership against.')
        .setRequired(true)
    )
    .addRoleOption(opt =>
      opt
        .setName('role')
        .setDescription('Role to grant after successful verification.')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('payment_wallet')
        .setDescription('Wallet address that receives verification transactions.')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('token_id')
        .setDescription('Token ID — only for ERC-1155 contracts.')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const collectionName  = interaction.options.getString('collection_name').trim();
    const contractInput   = interaction.options.getString('contract').trim();
    const role            = interaction.options.getRole('role');
    const walletInput     = interaction.options.getString('payment_wallet').trim();
    const tokenId         = interaction.options.getString('token_id')?.trim() || null;

    if (!/^0x[0-9a-fA-F]{40}$/.test(contractInput)) {
      await interaction.editReply({ content: '❌ Invalid contract address format.' });
      return;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(walletInput)) {
      await interaction.editReply({ content: '❌ Invalid payment wallet address format.' });
      return;
    }

    let contractAddress, paymentWallet;
    try { contractAddress = ethers.getAddress(contractInput); } catch { contractAddress = contractInput.toLowerCase(); }
    try { paymentWallet   = ethers.getAddress(walletInput);   } catch { paymentWallet   = walletInput.toLowerCase(); }

    await setItlGuildSettings(interaction.guildId, role.id, paymentWallet, collectionName, contractAddress, tokenId);

    await interaction.editReply({
      content:
        `✅ **ITL verification configured!**\n\n` +
        `**Collection:** ${collectionName}\n` +
        `**Contract:** \`${contractAddress}\`\n` +
        `**Role:** <@&${role.id}>\n` +
        `**Payment wallet:** \`${paymentWallet}\`\n` +
        (tokenId ? `**Token ID:** \`${tokenId}\`\n` : '') +
        `\nRun \`/itl-setup\` to post the verification embed.`,
    });
  },
};
