import { ethers, upgrades } from "hardhat";
import * as contracts from "../typechain";
import readline from "readline";

async function main(
  nft: string,
  authorizedMetaSigner: string,
  paymentMethodsContract: string,
  forwarderAddress: string
) {
  const { PRIVATE_KEY, ADMIN_ACCOUNT, SERVICE_ACCOUNT, VAULT_ADDRESS } =
    process.env;
  if (!PRIVATE_KEY || !ADMIN_ACCOUNT || !SERVICE_ACCOUNT || !VAULT_ADDRESS)
    return;

  const deployer = new ethers.Wallet(PRIVATE_KEY, ethers.provider);

  console.log("deployer", deployer.address);

  const NFTSellerFactory = await new contracts.NFTSeller__factory(deployer);
  const seller = await upgrades.deployProxy(
    NFTSellerFactory,
    [
      ADMIN_ACCOUNT,
      SERVICE_ACCOUNT,
      nft,
      paymentMethodsContract,
      authorizedMetaSigner,
      VAULT_ADDRESS,
      forwarderAddress,
    ],
    { constructorArgs: [forwarderAddress] }
  );

  console.log("NFT Seller", seller.address);
}

const rd = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
rd.question(`NFT Contract Address? `, (nft: string) => {
  rd.question(`authorizedMetaSigner? `, (authorizedMetaSigner: string) => {
    rd.question(`PaymentMethods Contract ? `, (paymentMethodsContract: string) => {
      rd.question(`Forwarder address? `, (forwarderAddress: string) => {
          rd.close();
          main(nft, authorizedMetaSigner, paymentMethodsContract, forwarderAddress)
            .then(() => process.exit(0))
            .catch((error) => {
              console.error(error);
              process.exit(1);
        });
      });
    });
  });
});
