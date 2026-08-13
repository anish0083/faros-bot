const CHAIN = {
  name: process.env.CHAIN_NAME || 'ITL Testnet',
  chainId: Number(process.env.CHAIN_ID || 19042026),
  rpcUrl: process.env.RPC_URL || 'https://evm-rpc.test-net.interlinklabs.ai/v1',
  explorerUrl: process.env.EXPLORER_URL || 'https://explorer.test-net.interlinklabs.ai',
  isTestnet: String(process.env.CHAIN_IS_TESTNET || 'true') === 'true',
};

const NFT = {
  address: process.env.NFT_CONTRACT_ADDRESS || '0xD3C7D72c9E9770996F419584f8EC42fb84777715',
  name: process.env.NFT_COLLECTION_NAME || 'Beacon Pass NFT',
  tokenId: process.env.NFT_TOKEN_ID || '',
};

const EXPLORER_API = {
  baseUrl: (process.env.EXPLORER_API_URL || CHAIN.explorerUrl).replace(/\/+$/, ''),
  timeoutMs: Number(process.env.EXPLORER_TIMEOUT_MS || 12000),
  retries: Number(process.env.EXPLORER_RETRIES || 3),
};

function validateChainConfig() {
  const problems = [];

  if (!/^0x[0-9a-fA-F]{40}$/.test(NFT.address)) {
    problems.push(`NFT_CONTRACT_ADDRESS has an invalid format: ${NFT.address}`);
  }
  if (!NFT.name) problems.push('NFT_COLLECTION_NAME is empty');
  if (!/^https?:\/\//.test(EXPLORER_API.baseUrl)) {
    problems.push(`EXPLORER_URL must be an http(s) URL: ${EXPLORER_API.baseUrl}`);
  }

  if (problems.length) {
    throw new Error(`Chain config incomplete:\n  - ${problems.join('\n  - ')}`);
  }
}

function explorerAddressLink(address) {
  if (!CHAIN.explorerUrl) return `\`${address}\``;
  const base = CHAIN.explorerUrl.replace(/\/+$/, '');
  return `[\`${address}\`](${base}/address/${address})`;
}

function chainFooter() {
  const parts = [CHAIN.name];
  if (CHAIN.chainId) parts.push(`Chain ID: ${CHAIN.chainId}`);
  return parts.join(' • ');
}

module.exports = { CHAIN, NFT, EXPLORER_API, validateChainConfig, explorerAddressLink, chainFooter };
