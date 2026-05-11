const { ethers } = require('ethers');

const ERC721_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

async function checkNFTOwnership(walletAddress, contractAddress, rpcUrl) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);

  let balance;
  try {
    balance = await contract.balanceOf(walletAddress);
  } catch (error) {
    throw new Error(`balanceOf failed: ${error.message}`);
  }

  if (balance === 0n) return [];

  // Try ERC721Enumerable first
  try {
    const tokenIds = [];
    const count = Number(balance);
    for (let i = 0; i < count; i++) {
      const tokenId = await contract.tokenOfOwnerByIndex(walletAddress, i);
      tokenIds.push(tokenId);
    }
    console.log(`[Blockchain] Enumerable: ${tokenIds.length} token(s) for ${walletAddress}`);
    return tokenIds;
  } catch {
    console.log(`[Blockchain] Enumerable not supported, using Transfer event fallback for ${walletAddress}`);
  }

  // Fallback: scan all Transfer events from block 0
  const latestBlock = await provider.getBlockNumber();
  const filter = contract.filters.Transfer(null, walletAddress, null);
  let events = [];
  try {
    events = await contract.queryFilter(filter, 0, latestBlock);
  } catch {
    // RPC range limit — chunk it
    const CHUNK = 500000;
    for (let start = 0; start <= latestBlock; start += CHUNK) {
      const end = Math.min(start + CHUNK - 1, latestBlock);
      const chunk = await contract.queryFilter(filter, start, end);
      events.push(...chunk);
    }
  }

  if (events.length === 0) return [];

  const uniqueTokenIds = [...new Set(events.map(e => e.args.tokenId))];
  const owned = [];
  for (const tokenId of uniqueTokenIds) {
    try {
      const owner = await contract.ownerOf(tokenId);
      if (owner.toLowerCase() === walletAddress.toLowerCase()) {
        owned.push(tokenId);
      }
    } catch {
      // burned or invalid
    }
  }

  console.log(`[Blockchain] Event fallback: ${owned.length} token(s) for ${walletAddress}`);
  return owned;
}

module.exports = { checkNFTOwnership };
