import { ethers } from "hardhat"
import readline from "readline"
import  * as contracts from "../typechain";



async function main(name: string, symbol: string, initialSupply: string, forwarderAddress: string, policyAddress: string) {
  const {PRIVATE_KEY, ADMIN_ACCOUNT, MINTER_ACCOUNT} = process.env
  if (!PRIVATE_KEY || !ADMIN_ACCOUNT || !MINTER_ACCOUNT)
    return
  
  const deployer = new ethers.Wallet(PRIVATE_KEY, ethers.provider)

  console.log('deployer', deployer.address)
  
  const token = await new contracts.TokenMintable__factory(deployer).deploy(
    MINTER_ACCOUNT,
    ADMIN_ACCOUNT,
    name,
    symbol,
    ethers.utils.parseUnits(initialSupply, 'ether'),
    forwarderAddress,
    policyAddress
  )
}

const rd = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

rd.question(`Token name?`, (name: string) => {
  rd.question(`Token symbol?`, (symbol: string) => {
    rd.question(`Token initial supply in ether (10^18)?`, (initialSupply: string) => {
      rd.question(`Forwarder address?`, (forwarderAddress: string) => {
        rd.question(`Policy address?`, (policyAddress: string) => {
          rd.close()
          main(name, symbol, initialSupply, forwarderAddress, policyAddress)
            .then(() => process.exit(0))
            .catch((error) => {
              console.error(error);
              process.exit(1);
            });
        })
      })
    })
  })
})