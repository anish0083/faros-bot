const { MessageFlags } = require('discord.js');
const { checkNFTOwnership } = require('../utils/blockchain');
const { hasUserClaimed, markTokenUsed, getServerConfig } = require('../utils/database');

module.exports = async function handleClaimModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guildId    = interaction.guildId;
  const ethAddress = interaction.fields.getTextInputValue('eth_address_input').trim();
  const member     = interaction.member;

  const config = await getServerConfig(guildId);
  if (!config) {
    await interaction.editReply({ content: '❌ This server has not been configured yet. Ask an admin to run `/config`.' });
    return;
  }

  const { role_id: roleId, nft_contract_address: contractAddress, rpc_url: rpcUrl } = config;

  if (!/^0x[0-9a-fA-F]{40}$/.test(ethAddress)) {
    await interaction.editReply({
      content:
        '❌ **Invalid address format.**\n' +
        'Must start with `0x` followed by exactly 40 hex characters.\n' +
        'Example: `0x1234567890abcdef1234567890abcdef12345678`',
    });
    return;
  }

  if (await hasUserClaimed(guildId, member.id)) {
    await interaction.editReply({ content: '❌ You have already claimed your role in this server.' });
    return;
  }

  if (member.roles.cache.has(roleId)) {
    await interaction.editReply({ content: '✅ You already have this role!' });
    return;
  }

  let holdsNFT;
  try {
    holdsNFT = await checkNFTOwnership(ethAddress, contractAddress, rpcUrl);
  } catch (error) {
    console.error('[Claim] Blockchain error:', error);
    await interaction.editReply({ content: '❌ Could not connect to the blockchain. Please try again in a moment.' });
    return;
  }

  if (!holdsNFT) {
    await interaction.editReply({
      content:
        `❌ Wallet \`${ethAddress}\` does not hold any NFTs from the verified collection.\n\n` +
        'Make sure you entered the correct wallet address.',
    });
    return;
  }

  try {
    await member.roles.add(roleId);
  } catch (error) {
    console.error('[Claim] Role grant error:', error);
    await interaction.editReply({
      content: '❌ Could not grant the role. Make sure the bot has **Manage Roles** permission and its role is above the target role.',
    });
    return;
  }

  await markTokenUsed(guildId, '0', member.id, ethAddress);

  await interaction.editReply({
    content:
      `✅ You have been granted the <@&${roleId}> role!\n\n` +
      `**Verified wallet:** \`${ethAddress}\`\n\n` +
      'Welcome!',
  });

  console.log(`[Claim] SUCCESS | Guild: ${guildId} | User: ${member.id} | Wallet: ${ethAddress}`);
};
