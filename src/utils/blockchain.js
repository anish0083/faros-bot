const { ethers } = require('ethers');

const ERC1155_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
];

async function checkNFTOwnership(walletAddress, contractAddress, rpcUrl) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, ERC1155_ABI, provider);
  const balance = await contract.balanceOf(walletAddress, 0);
  return balance > 0n;
}

module.exports = { checkNFTOwnership };
