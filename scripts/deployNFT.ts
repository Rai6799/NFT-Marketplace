import { ethers, upgrades } from "hardhat";
import * as contracts from "../typechain";
import readline from "readline";

async function main(
  name: string,
  symbol: string,
  baseTokenURI: string,
  forwarderAddress: string,
  policyAddress: string
) {
  const { PRIVATE_KEY, ADMIN_ACCOUNT, MINTER_ACCOUNT } = process.env;
  if (!PRIVATE_KEY || !ADMIN_ACCOUNT || !MINTER_ACCOUNT) return;

  const deployer = new ethers.Wallet(PRIVATE_KEY, ethers.provider);

  console.log("deployer", deployer.address);

  const NFTfactory = await new contracts.MokensNFT__factory(deployer);

  const nft = await upgrades.deployProxy(
    NFTfactory,
    [
      name,
      symbol,
      baseTokenURI,
      ADMIN_ACCOUNT,
      MINTER_ACCOUNT,
      policyAddress,
      forwarderAddress,
    ],
    {
      constructorArgs: [forwarderAddress],
    }
  );

  console.log("nft", nft.address);
}

const rd = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
rd.question(`NFT Name? `, (name: string) => {
  rd.question(`NFT Symbol? `, (symbol: string) => {
    rd.question(`baseTokenURI ? `, (baseTokenURI: string) => {
      rd.question(`Forwarder address? `, (forwarderAddress: string) => {
        rd.question(`Policy address? `, (policyAddress: string) => {
          rd.close();
          main(name, symbol, baseTokenURI, forwarderAddress, policyAddress)
            .then(() => process.exit(0))
            .catch((error) => {
              console.error(error);
              process.exit(1);
            });
        });
      });
    });
  });
});
