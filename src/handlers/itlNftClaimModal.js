const { MessageFlags } = require('discord.js');
const { ethers } = require('ethers');
const { EXPLORER_API } = require('../config/chain');
const { getItlNftConfigs, hasNftClaim, recordNftClaim } = require('../utils/itlDatabase');

async function checkNftBalance(walletAddress, contractAddress, tokenId) {
  const params = new URLSearchParams({
    module: 'account',
    action: 'tokenbalance',
    contractaddress: contractAddress,
    address: walletAddress,
  });
  if (tokenId) params.set('tokenid', tokenId);

  const res = await fetch(`${EXPLORER_API.baseUrl}/api?${params}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(EXPLORER_API.timeoutMs),
  });

  if (!res.ok) throw new Error(`Explorer HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== '1' || data.result === null) return false;
  return BigInt(data.result) > 0n;
}

module.exports = async function handleItlNftClaimModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guildId = interaction.guildId;
  const member  = interaction.member;
  const input   = interaction.fields.getTextInputValue('itl_nft_wallet_input').trim();

  const configs = await getItlNftConfigs(guildId);
  if (!configs.length) {
    await interaction.editReply({ content: '❌ No NFT collections configured for this server.' });
    return;
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(input)) {
    await interaction.editReply({
      content:
        '❌ **Invalid address format.**\n' +
        'Must start with `0x` followed by exactly 40 hex characters.\n' +
        'Example: `0x1234567890abcdef1234567890abcdef12345678`',
    });
    return;
  }

  let walletAddress;
  try {
    walletAddress = ethers.getAddress(input);
  } catch {
    walletAddress = input.toLowerCase();
  }

  const rolesGranted   = [];
  const alreadyClaimed = [];
  const notHeld        = [];

  for (const config of configs) {
    if (await hasNftClaim(guildId, member.id, config.contract_address)) {
      alreadyClaimed.push(config.collection_name);
      continue;
    }

    let holds;
    try {
      holds = await checkNftBalance(walletAddress, config.contract_address, config.token_id);
    } catch (err) {
      console.error(`[ITL NFT Claim] Balance check failed for ${config.contract_address}:`, err.message);
      continue;
    }

    if (!holds) {
      notHeld.push(config.collection_name);
      continue;
    }

    try {
      await member.roles.add(config.role_id);
      await recordNftClaim(guildId, member.id, config.contract_address, walletAddress);
      rolesGranted.push({ name: config.collection_name, roleId: config.role_id });
    } catch (err) {
      console.error(`[ITL NFT Claim] Role grant failed for ${config.role_id}:`, err.message);
    }
  }

  const lines = [];

  if (rolesGranted.length) {
    lines.push(
      `✅ **Roles granted:**\n` +
      rolesGranted.map(r => `• <@&${r.roleId}> — ${r.name}`).join('\n')
    );
  }
  if (alreadyClaimed.length) {
    lines.push(
      `ℹ️ **Already claimed:**\n` +
      alreadyClaimed.map(n => `• ${n}`).join('\n')
    );
  }
  if (notHeld.length) {
    lines.push(
      `❌ **Not holding:**\n` +
      notHeld.map(n => `• ${n}`).join('\n')
    );
  }

  if (!lines.length) {
    await interaction.editReply({ content: '❌ Could not verify any NFT holdings. Try again in a moment.' });
    return;
  }

  await interaction.editReply({ content: lines.join('\n\n') });

  if (rolesGranted.length) {
    console.log(`[ITL NFT Claim] Guild: ${guildId} | User: ${member.id} | Wallet: ${walletAddress} | Roles: ${rolesGranted.length}`);
  }
};
