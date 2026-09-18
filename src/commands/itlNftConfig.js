const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { ethers } = require('ethers');
const { addItlNftConfig, getItlNftConfigs } = require('../utils/itlDatabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('itl-nft-config')
    .setDescription('Add an NFT collection for holder role verification on ITL chain.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('contract')
        .setDescription('NFT contract address (0x...).')
        .setRequired(true)
    )
    .addRoleOption(opt =>
      opt.setName('role')
        .setDescription('Role to assign to holders of this collection.')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Display name for the collection.')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('token_id')
        .setDescription('Token ID — only required for ERC-1155 contracts.')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const contractInput = interaction.options.getString('contract').trim();
    const role          = interaction.options.getRole('role');
    const name          = interaction.options.getString('name').trim();
    const tokenId       = interaction.options.getString('token_id')?.trim() || null;

    if (!/^0x[0-9a-fA-F]{40}$/.test(contractInput)) {
      await interaction.editReply({ content: '❌ Invalid contract address format. Must be `0x` + 40 hex characters.' });
      return;
    }

    let contractAddress;
    try {
      contractAddress = ethers.getAddress(contractInput);
    } catch {
      contractAddress = contractInput.toLowerCase();
    }

    await addItlNftConfig(interaction.guildId, contractAddress, role.id, name, tokenId);

    const configs = await getItlNftConfigs(interaction.guildId);

    const list = configs
      .map((c, i) =>
        `**${i + 1}. ${c.collection_name}**\n` +
        `Role: <@&${c.role_id}>\n` +
        `Contract: \`${c.contract_address}\`` +
        (c.token_id ? `\nToken ID: \`${c.token_id}\`` : '')
      )
      .join('\n\n');

    const embed = new EmbedBuilder()
      .setTitle('✅ NFT Collection Saved')
      .setDescription(`**All configured collections for this server:**\n\n${list}\n\n` +
        'Run `/itl-nft-setup` to post the claim button in a channel.')
      .setColor(0x57F287);

    await interaction.editReply({ embeds: [embed] });
  },
};
