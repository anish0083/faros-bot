const { MessageFlags } = require('discord.js');
const { ethers } = require('ethers');
const { checkNFTOwnership } = require('../utils/blockchain');
const { hasUserClaimed, recordClaim, getGuildRole } = require('../utils/database');
const { CHAIN, NFT } = require('../config/chain');

module.exports = async function handleClaimModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guildId = interaction.guildId;
  const input   = interaction.fields.getTextInputValue('eth_address_input').trim();
  const member  = interaction.member;

  const config = await getGuildRole(guildId);
  if (!config) {
    await interaction.editReply({ content: '❌ This server has not been configured yet. Ask an admin to run `/config`.' });
    return;
  }

  const roleId = config.role_id;

  if (!/^0x[0-9a-fA-F]{40}$/.test(input)) {
    await interaction.editReply({
      content:
        '❌ **Invalid address format.**\n' +
        'Must start with `0x` followed by exactly 40 hex characters.\n' +
        'Example: `0x1234567890abcdef1234567890abcdef12345678`',
    });
    return;
  }

  let ethAddress;
  try {
    ethAddress = ethers.getAddress(input);
  } catch {
    ethAddress = ethers.getAddress(input.toLowerCase());
  }

  if (await hasUserClaimed(guildId, member.id)) {
    await interaction.editReply({ content: '❌ You have already claimed your role in this server.' });
    return;
  }

  if (member.roles.cache.has(roleId)) {
    await interaction.editReply({ content: '✅ You already have this role!' });
    return;
  }

  let result;
  try {
    result = await checkNFTOwnership(ethAddress);
  } catch (error) {
    console.error('[Claim] Ownership lookup error:', error);
    await interaction.editReply({ content: `❌ Could not verify your wallet on ${CHAIN.name} right now. Please try again in a moment.` });
    return;
  }

  if (!result.holds) {
    await interaction.editReply({
      content:
        `❌ Wallet \`${ethAddress}\` does not hold **${NFT.name}** on ${CHAIN.name}.\n\n` +
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

  await recordClaim(guildId, member.id, ethAddress, NFT.address);

  await interaction.editReply({
    content:
      `✅ You have been granted the <@&${roleId}> role!\n\n` +
      `**Verified wallet:** \`${ethAddress}\`\n` +
      `**Holding:** ${result.balance} × ${NFT.name}\n\n` +
      'Welcome!',
  });

  console.log(`[Claim] SUCCESS | Guild: ${guildId} | User: ${member.id} | Wallet: ${ethAddress} | Balance: ${result.balance}`);
};
