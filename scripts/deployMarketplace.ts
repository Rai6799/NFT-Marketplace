import { ethers, upgrades } from "hardhat";
import * as contracts from "../typechain";
import readline from "readline";

async function main(
  nft: string,
//   authorizedMetaSigner: string,
  paymentMethodsContract: string,
  forwarderAddress: string,
  commission: string
) {
  const { PRIVATE_KEY, ADMIN_ACCOUNT, VAULT_ADDRESS } =
    process.env;
  if (!PRIVATE_KEY || !ADMIN_ACCOUNT || !VAULT_ADDRESS)
    return;

  const deployer = new ethers.Wallet(PRIVATE_KEY, ethers.provider);

  console.log("deployer", deployer.address);

  const MarketplaceFactory = await new contracts.Marketplace__factory(deployer);
  const marketplace = (await upgrades.deployProxy(
    MarketplaceFactory,
    [
      ADMIN_ACCOUNT,
      nft,
      paymentMethodsContract,
    //   authorizedMetaSigner,
      VAULT_ADDRESS,
      forwarderAddress,
      commission,
    ],
    { constructorArgs: [forwarderAddress] }
  )) as contracts.Marketplace;

  console.log("Marketplace", marketplace.address);
}

const rd = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
rd.question(`NFT Contract Address? `, (nft: string) => {
//   rd.question(`authorizedMetaSigner? `, (authorizedMetaSigner: string) => {
    rd.question(`PaymentMethods Contract ? `, (paymentMethodsContract: string) => {
      rd.question(`Forwarder address? `, (forwarderAddress: string) => {
      rd.question(`Commission? `, (commission: string) => {
          rd.close();
          main(nft, paymentMethodsContract, forwarderAddress, commission)
            .then(() => process.exit(0))
            .catch((error) => {
              console.error(error);
              process.exit(1);
        });
      });
    });
  });
});
