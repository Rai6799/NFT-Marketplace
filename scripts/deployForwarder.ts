import { ethers } from "hardhat"
import  * as contracts from "../typechain";

async function main() {
  const {PRIVATE_KEY, ADMIN_ACCOUNT, FORWARDER_NAME, FORWARDER_VERSION = '2'} = process.env
  if (!PRIVATE_KEY || !ADMIN_ACCOUNT || !FORWARDER_NAME)
    return
  
  const deployer = new ethers.Wallet(PRIVATE_KEY, ethers.provider)

  console.log('deployer', deployer.address)

  const forwarder = await new contracts.MinimalForwarder__factory(deployer).deploy(FORWARDER_NAME, FORWARDER_VERSION)
  console.log('forwarder', forwarder.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });