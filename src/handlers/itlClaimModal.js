const { MessageFlags } = require('discord.js');
const { ethers } = require('ethers');
const { EXPLORER_API, CHAIN } = require('../config/chain');

const NFT_CHECK_TIMEOUT_MS = 12000;
const {
  getItlGuildSettings,
  hasUserItlClaimed,
  getPendingClaimByUser,
  createPendingClaim,
  getStrikeInfo,
} = require('../utils/itlDatabase');

const DISPLAY_AMOUNTS = ['0.001', '0.002', '0.003'];

const ERC721_ABI  = ['function balanceOf(address owner) view returns (uint256)'];
const ERC1155_ABI = ['function balanceOf(address account, uint256 id) view returns (uint256)'];

async function checkNftBalanceViaRpc(rpcUrl, walletAddress, contractAddress, tokenId) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  if (tokenId) {
    const contract = new ethers.Contract(contractAddress, ERC1155_ABI, provider);
    const bal = await contract.balanceOf(walletAddress, BigInt(tokenId));
    return BigInt(bal);
  }
  const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
  const bal = await contract.balanceOf(walletAddress);
  return BigInt(bal);
}

async function checkNftBalanceViaExplorer(explorerBaseUrl, walletAddress, contractAddress, tokenId) {
  const params = new URLSearchParams({
    module: 'account',
    action: 'tokenbalance',
    contractaddress: contractAddress,
    address: walletAddress,
  });
  if (tokenId) params.set('tokenid', tokenId);

  const res = await fetch(`${explorerBaseUrl}/api?${params}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(NFT_CHECK_TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`Explorer HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== '1' || data.result === null) return 0n;
  return BigInt(data.result);
}

async function checkNftBalance(settings, walletAddress) {
  const { contract_address, token_id, nft_rpc_url, nft_explorer_url } = settings;
  if (nft_rpc_url) {
    return checkNftBalanceViaRpc(nft_rpc_url, walletAddress, contract_address, token_id);
  }
  const explorerBase = (nft_explorer_url || EXPLORER_API.baseUrl).replace(/\/+$/, '');
  return checkNftBalanceViaExplorer(explorerBase, walletAddress, contract_address, token_id);
}

module.exports = async function handleItlClaimModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guildId = interaction.guildId;
  const member  = interaction.member;
  const input   = interaction.fields.getTextInputValue('itl_wallet_input').trim();

  const settings = await getItlGuildSettings(guildId);
  if (!settings) {
    await interaction.editReply({ content: '❌ This server has not been configured yet. Ask an admin to run `/itl-config`.' });
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

  if (await hasUserItlClaimed(guildId, member.id)) {
    await interaction.editReply({ content: '❌ You have already completed wallet verification in this server.' });
    return;
  }

  if (member.roles.cache.has(settings.role_id)) {
    await interaction.editReply({ content: '✅ You already have this role!' });
    return;
  }

  const strikeInfo = await getStrikeInfo(guildId, member.id);
  if (strikeInfo?.timeout_until && new Date(strikeInfo.timeout_until) > new Date()) {
    const ts = Math.floor(new Date(strikeInfo.timeout_until).getTime() / 1000);
    await interaction.editReply({
      content: `🚫 **You are timed out.**\n\nYou can try again <t:${ts}:R>.`,
    });
    return;
  }

  // Step 1 — Check NFT ownership on mainnet
  if (settings.contract_address) {
    let balance;
    try {
      balance = await checkNftBalance(settings, walletAddress);
    } catch (err) {
      console.error('[ITL Claim] NFT check error:', err.message);
      await interaction.editReply({
        content: `❌ Could not verify NFT ownership on ${CHAIN.name} right now. Please try again in a moment.`,
      });
      return;
    }

    if (balance === 0n) {
      await interaction.editReply({
        content:
          `❌ Wallet \`${walletAddress}\` does not hold **${settings.collection_name || 'the required NFT'}** on ${CHAIN.name}.\n\n` +
          'Make sure you entered the correct wallet address.',
      });
      return;
    }
  }

  // Step 2 — NFT confirmed, check for existing pending claim
  const existing = await getPendingClaimByUser(guildId, member.id);
  if (existing) {
    const minutesLeft = Math.max(1, Math.ceil((new Date(existing.expires_at) - Date.now()) / 60000));
    await interaction.editReply({
      content:
        `⏳ **You already have a pending verification.**\n\n` +
        `Send any amount from your wallet:\n\`${existing.wallet_address}\`\n\n` +
        `To this address:\n\`\`\`${existing.payment_wallet}\`\`\`\n` +
        `⏰ Expires in **${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}**.`,
    });
    return;
  }

  const displayAmount = DISPLAY_AMOUNTS[Math.floor(Math.random() * DISPLAY_AMOUNTS.length)];
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await createPendingClaim(
    guildId,
    member.id,
    walletAddress,
    displayAmount,
    settings.payment_wallet,
    settings.role_id,
    expiresAt,
  );

  const collectionLabel = settings.collection_name || 'the required NFT';

  await interaction.editReply({
    content:
      `✅ **Cool! This wallet holds ${collectionLabel}.**\n\n` +
      `Now complete a small transaction to verify wallet ownership.\n\n` +
      `**From your wallet:**\n\`${walletAddress}\`\n\n` +
      `**To this address:**\n\`\`\`${settings.payment_wallet}\`\`\`\n` +
      `**Suggested amount:** \`${displayAmount} ITL\` (any amount works)\n\n` +
      `⏰ You have **15 minutes** to send the transaction.\n` +
      `Your role will be granted automatically once detected.`,
  });

  console.log(`[ITL Claim] NFT verified + pending | Guild: ${guildId} | User: ${member.id} | Wallet: ${walletAddress}`);
};
