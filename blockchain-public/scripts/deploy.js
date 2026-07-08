import hre from "hardhat";

async function main() {
  console.log("Desplegando TrazabilidadMaizNFT...");

  const TrazabilidadMaizNFT = await hre.ethers.getContractFactory("TrazabilidadMaizNFT");
  const nft = await TrazabilidadMaizNFT.deploy();

  await nft.waitForDeployment();

  const targetAddress = await nft.getAddress();
  console.log(`TrazabilidadMaizNFT desplegado en: ${targetAddress}`);
  console.log("-> Copia este address y pégalo en backend/server.js en NFT_CONTRACT_ADDRESS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
