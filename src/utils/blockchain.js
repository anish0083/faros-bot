const { ethers } = require('ethers');

const ERC721_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

const ERC1155_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)',
];

const ERC1155_INTERFACE_ID = '0xd9b67a26';

async function checkNFTOwnership(walletAddress, contractAddress, rpcUrl) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Detect contract type
  let isERC1155 = false;
  try {
    const probe = new ethers.Contract(contractAddress, ERC721_ABI, provider);
    isERC1155 = await probe.supportsInterface(ERC1155_INTERFACE_ID);
  } catch {
    // supportsInterface not available — try ERC-721 balanceOf
  }

  if (isERC1155) {
    return checkERC1155Ownership(walletAddress, contractAddress, provider);
  }
  return checkERC721Ownership(walletAddress, contractAddress, provider);
}

async function checkERC1155Ownership(walletAddress, contractAddress, provider) {
  const contract = new ethers.Contract(contractAddress, ERC1155_ABI, provider);
  const latestBlock = await provider.getBlockNumber();

  // Collect token IDs received by this wallet via TransferSingle
  const singleFilter = contract.filters.TransferSingle(null, null, walletAddress, null, null);
  let singleEvents = [];
  try {
    singleEvents = await contract.queryFilter(singleFilter, 0, latestBlock);
  } catch {
    const CHUNK = 500000;
    for (let start = 0; start <= latestBlock; start += CHUNK) {
      const end = Math.min(start + CHUNK - 1, latestBlock);
      const chunk = await contract.queryFilter(singleFilter, start, end);
      singleEvents.push(...chunk);
    }
  }

  const tokenIdSet = new Set(singleEvents.map(e => e.args.id.toString()));

  // Also check token ID 0 by default (common for simple collections)
  tokenIdSet.add('0');

  const ownedTokenIds = [];
  for (const tokenId of tokenIdSet) {
    try {
      const balance = await contract.balanceOf(walletAddress, tokenId);
      if (balance > 0n) {
        ownedTokenIds.push(BigInt(tokenId));
      }
    } catch {
      // skip
    }
  }

  console.log(`[Blockchain] ERC-1155: ${ownedTokenIds.length} token(s) for ${walletAddress}`);
  return ownedTokenIds;
}

async function checkERC721Ownership(walletAddress, contractAddress, provider) {
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
    console.log(`[Blockchain] ERC-721 Enumerable: ${tokenIds.length} token(s) for ${walletAddress}`);
    return tokenIds;
  } catch {
    console.log(`[Blockchain] Enumerable not supported, using Transfer event fallback for ${walletAddress}`);
  }

  // Fallback: scan Transfer events
  const latestBlock = await provider.getBlockNumber();
  const filter = contract.filters.Transfer(null, walletAddress, null);
  let events = [];
  try {
    events = await contract.queryFilter(filter, 0, latestBlock);
  } catch {
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

  console.log(`[Blockchain] ERC-721 Event fallback: ${owned.length} token(s) for ${walletAddress}`);
  return owned;
}

module.exports = { checkNFTOwnership };
