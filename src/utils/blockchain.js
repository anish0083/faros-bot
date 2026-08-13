const { CHAIN, NFT, EXPLORER_API } = require('../config/chain');

let tokenInfo = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function explorerRequest(path) {
  let lastError;

  for (let attempt = 0; attempt < EXPLORER_API.retries; attempt++) {
    if (attempt > 0) {
      const backoff = 400 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
      await sleep(backoff);
    }

    try {
      const response = await fetch(EXPLORER_API.baseUrl + path, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(EXPLORER_API.timeoutMs),
      });

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`Explorer returned HTTP ${response.status}`);
        continue;
      }
      if (!response.ok) {
        throw new Error(`Explorer returned HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Explorer request failed');
}

async function fetchTokenInfo() {
  if (tokenInfo) return tokenInfo;

  const data = await explorerRequest(`/api/v2/tokens/${NFT.address}`);
  if (!data || !data.type) {
    throw new Error(`${NFT.address} is not indexed as a token by the explorer`);
  }

  tokenInfo = {
    type: String(data.type).toUpperCase(),
    name: data.name || NFT.name,
    symbol: data.symbol || '',
    holders: data.holders_count || null,
  };

  return tokenInfo;
}

async function checkNFTOwnership(walletAddress) {
  const info = await fetchTokenInfo();

  const params = new URLSearchParams({
    module: 'account',
    action: 'tokenbalance',
    contractaddress: NFT.address,
    address: walletAddress,
  });

  if (info.type === 'ERC-1155') {
    if (!NFT.tokenId) {
      throw new Error('NFT_TOKEN_ID must be set for an ERC-1155 collection');
    }
    params.set('tokenid', NFT.tokenId);
  }

  const data = await explorerRequest(`/api?${params.toString()}`);

  if (data.status !== '1' || data.result === null || data.result === undefined) {
    throw new Error(`Explorer balance lookup failed: ${data.message || 'unknown error'}`);
  }

  const balance = BigInt(data.result);
  return { holds: balance > 0n, balance, standard: info.type };
}

async function verifyChainConnection() {
  const info = await fetchTokenInfo();

  if (info.type !== 'ERC-721' && info.type !== 'ERC-1155') {
    throw new Error(`${NFT.address} is a ${info.type} contract, not an NFT collection`);
  }
  if (info.type === 'ERC-1155' && !NFT.tokenId) {
    throw new Error('NFT_TOKEN_ID must be set for an ERC-1155 collection');
  }

  console.log(
    `[Chain] ${CHAIN.name} (chain ID ${CHAIN.chainId}) | ` +
    `${info.name}${info.symbol ? ` (${info.symbol})` : ''} | ${info.type}` +
    `${info.holders ? ` | ${info.holders} holders` : ''}`
  );
}

module.exports = { checkNFTOwnership, fetchTokenInfo, verifyChainConnection };
