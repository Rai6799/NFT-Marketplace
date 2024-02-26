// scripts/upgradeNFT.ts
import { ethers, upgrades } from "hardhat";
import * as contracts from "../typechain";
import readline from "readline";

async function main(
    proxyAddress: string
  ) {
    const { PRIVATE_KEY, ADMIN_ACCOUNT, MINTER_ACCOUNT } = process.env;
    if (!PRIVATE_KEY || !ADMIN_ACCOUNT || !MINTER_ACCOUNT) return;
  
    const deployer = new ethers.Wallet(PRIVATE_KEY, ethers.provider);
    console.log(proxyAddress," original NFT(proxy) address")

    //replace with new contract factory reference
    const NFTfactoryV2 = await new contracts.Token__factory(deployer);
    console.log("upgrade to NftV2...")
    
    const boxV2 = await upgrades.upgradeProxy(proxyAddress, NFTfactoryV2)
    console.log(boxV2.address,"NFT V2 address(should be the same)")
  
    console.log(await upgrades.erc1967.getImplementationAddress(boxV2.address)," getImplementationAddress")
    console.log(await upgrades.erc1967.getAdminAddress(boxV2.address), " getAdminAddress")    
    console.log("deployer", deployer.address);
  
  }
  
  const rd = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rd.question(`Proxy Address? `, (proxy: string) => {
            rd.close();
            main(proxy)
              .then(() => process.exit(0))
              .catch((error) => {
                console.error(error);
                process.exit(1);
              });
          });
  