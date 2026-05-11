const { MessageFlags } = require('discord.js');
const { ethers } = require('ethers');
const { setServerConfig } = require('../utils/database');

module.exports = async function handleConfigModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const contractAddress = interaction.fields.getTextInputValue('config_contract').trim();
  const rpcUrl          = interaction.fields.getTextInputValue('config_rpc').trim();
  const roleId          = interaction.fields.getTextInputValue('config_role').trim();

  if (!/^0x[0-9a-fA-F]{40}$/.test(contractAddress)) {
    await interaction.editReply({ content: '❌ **Invalid contract address.** Must be `0x` + 40 hex characters.' });
    return;
  }

  if (!/^\d{17,20}$/.test(roleId)) {
    await interaction.editReply({
      content: '❌ **Invalid Role ID.** Must be a numeric Discord snowflake (17–20 digits).\nRight-click the role → Copy Role ID.',
    });
    return;
  }

  const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
  if (!role) {
    await interaction.editReply({ content: `❌ **Role \`${roleId}\` not found** in this server.` });
    return;
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    await provider.getBlockNumber();
  } catch {
    await interaction.editReply({ content: `❌ **Could not connect to RPC:** \`${rpcUrl}\`` });
    return;
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const code = await provider.getCode(contractAddress);
    if (code === '0x') {
      await interaction.editReply({ content: `❌ **No contract found** at \`${contractAddress}\` on this RPC.` });
      return;
    }
  } catch {
    await interaction.editReply({ content: '❌ **Could not verify contract.** Check your RPC URL and contract address.' });
    return;
  }

  await setServerConfig(interaction.guildId, contractAddress, rpcUrl, roleId);

  await interaction.editReply({
    content:
      '✅ **Configuration saved!**\n\n' +
      `**NFT Contract:** \`${contractAddress}\`\n` +
      `**RPC URL:** \`${rpcUrl}\`\n` +
      `**Role:** <@&${roleId}> (${role.name})\n\n` +
      'Now run `/setupnft` in the channel where you want the claim embed.',
  });

  console.log(`[Config] Guild ${interaction.guildId} (${interaction.guild.name}) configured by ${interaction.user.tag}`);
};
