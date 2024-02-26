import { ethers } from "hardhat"
import readline from "readline"
import  * as contracts from "../typechain";



async function main(forwarderAddress: string, policyAddress: string) {
  const {PRIVATE_KEY, ADMIN_ACCOUNT} = process.env
  if (!PRIVATE_KEY || !ADMIN_ACCOUNT)
    return
  
  const deployer = new ethers.Wallet(PRIVATE_KEY, ethers.provider)
  const amount = ethers.utils.parseUnits('500000000', 'ether')

  console.log('deployer', deployer.address)

  const token = await new contracts.Token__factory(deployer).deploy(
    ADMIN_ACCOUNT,
    'Mokens League',
    'MOKA',
    amount,
    forwarderAddress,
    policyAddress
  )
  console.log('token', token.address)
}

const rd = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

rd.question(`Forwarder address? `, (forwarderAddress: string) => {
  rd.question(`Policy address? `, (policyAddress: string) => {
    rd.close()
    main(forwarderAddress, policyAddress)
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  })
})