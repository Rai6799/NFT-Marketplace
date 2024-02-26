# Mokens League Smart Contracts

## Requirements

* [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
* [Nodejs](https://nodejs.org/en/) & [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)

## Getting Started

1. Clone and install dependencies
   After installing all the requirements, run the following:

   ```
   git clone https://github.com/Mokens-League/mokens-league-tokens 
   cd mokens-league-tokens 
   ```
2. then ```npm i```
3. then ```npx hardhat compile```

## Smart Contract Brief Explanation

1. [Forwarder.sol](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.4.0/contracts/metatx/MinimalForwarder.sol)
   Simple minimal forwarder to be used together with an ERC2771 compatible contract.
2. [IERC4907.sol](https://eips.ethereum.org/EIPS/eip-4907)
   This standard is an extension of EIP-721. It proposes an additional role (user) which can be granted to addresses, and a time where the role is automatically revoked (expires). The user role represents permission to “use” the NFT, but not the ability to transfer it or set users.
3. IMokensNFT.sol
   MokensNFT.sol Interface Contract (IERC721Upgradeable)
5. INFTPolicy.sol
   Policy.sol Interface Contract.
6. IPaymentsMethods.sol
   PaymentsMethods.sol Interface Contract.
7. IPolicy.sol
   Policy.sol Interface Contract.
8. Marketplace.sol
   This is the contract that will be in charge of the rental/sale process in the Marketplace.
9. MokensNFT.sol
   This is the NFT Contract.
10. NFTSeller.sol
   This contract is in charge of selling lootboxes and managing their inventories. 
11. PaymentMethods.sol
   This contract is in charge of handling allowed payment methods in (NFTSeller & Marketplace)
12. Policy.sol
   This contract is in charge of handling policies that a token must satisfy in order to be transfered or sold. This applies to our ERC20 MOKA and ERC271 NFTs.
13. Token.sol
   ERC777 Fungible token MOKA

## Local Network Deployment

One of the best ways to test and interact with smart contracts is with a local network. To run a local network with all your contracts in it, run the following:

```npx hardhat node```

You'll get a local blockchain, private keys, contracts deployed (from the deploy folder scripts), and an endpoint to potentially add to an EVM wallet.

## Testnet/Mainnet Deployment

### Prerequisites

### Setup Administrator Wallet (MultiSig Gnosis Safe)

Gnosis Safe is a smart contract wallet that runs on the Ethereum blockchain. It allows you to create a wallet that can be controlled by multiple users and requires a minimum number of signatures before executing a transaction.

#### How does it work?

When you use a wallet like Metamask, it’s secured with a private key. If that key ends up in the wrong hands, your funds are compromised. It isn’t possible to share access securely with multiple people as one individual could control the funds in the wallet without the authorization of others. Gnosis Safe allows multiple wallets to be added and sets a minimum number of signatures needed to execute a transaction.

#### Step by Step Setup

1. Go to https://gnosis-safe.io/app/ and select the network you want to deploy your safe.
2. Connect your wallet to Gnosis Safe
3. Select "Create a new Safe"
4. Enter the Name of the Safe and press Start. This name is for your convenience only and will not be shared with any third party.
5. Add the wallet addresses of the owners of this safe and select the minimum number of confirmations required to execute a transaction. For Example, if set "4 out of 7 Owners", it means that any transaction will require at least four of the seven wallets listed to confirm such transaction before executing it.
6. Review and make sure the settings are correct.
7. (Make sure you have sufficient funds to pay for the safe's creation) Click submit to create the safe, you will see the Safe Creation Process Screen. Wait for the process to complete and display the success message you see below.

### Deployer Wallet

This is the wallet that will be used to deploy all smart contracts. Therefore, make sure it has sufficient funds.

**Disclaimer : Do not use the Main Wallet Private for deployment purposes. Use a Burner wallet or create a new wallet.**

#### Create a burner wallet in Python:

```
import web3
web3.Account.create()
<eth_account.signers.local.LocalAccount at 0x10cec9e50>
_2.privateKey
HexBytes('0xf7e591336edd86343ee4ee905fa445601d4c7ee5858d68fdacc32d4cd5a58e33')
_2.address
'0x8b191c7eBD69Ea6c7a1584e7F299571236566Bea'
```

#### Cost of deploying a smart contract

To calculate Mainet cost, we need to deploy the same contract to a testnet. We expect it to consume the same amount of gas.

```Cost = Gas Price x Amount of Gas Consumed```

Deployment Scripts will need the private key of this wallet to deploy all contracts.

## Deployment Procedure - ERC-20 Token (MOKA)

1. git checkout v1.0.1
2. ```npx hardhat compile```
3. Get Free PolygonScan API Key [(here)](https://polygonscan.com/apis)
4. Get Infura PROJECT ID & RPC LINKS [(here)](https://ethereumico.io/knowledge-base/infura-api-key-guide/) for Polygon Mainnet
5. Setup hardhat.config.ts with infura polygon MAINNET RPC link
6. Setup a deployer addr [here](#deployer-wallet)
7. Fund Deployer addr with MATIC to perform all deployments
8. Setup Mainnet Gnosis Safe with required owners addresses
9. Setup environment variables .env
   1. ```
      ETHERSCAN_API_KEY= https://info.etherscan.com/api-keys/
      INFURA_KEY= https://ethereumico.io/knowledge-base/infura-api-key-guide/
      PRIVATE_KEY= DEPLOYER_PRIVATE_ADDR
      ADMIN_ACCOUNT=GNOSIS_SAFE_ADDR# Often is a Gnosis-Safe wallet
      MINTER_ACCOUNT=GNOSIS_SAFE_ADDR# Can be the admin account
      FORWARDER_NAME=MokensMOKA # Name used in the ERC712 domain, https://eips.ethereum.org/EIPS/eip-712

      ```
10. Deploy Forwarder ```npx hardhat run scripts/deployForwarder.ts --network polygon```. Make sure to save this address in order to verify it.
11. Verify Forwarder ```npx hardhat verify FORWARDER_ADDR --network polygon MokensMOKA 2```
12. Deploy Policy ```npx hardhat run scripts/deployPolicy.ts --network polygon```. Make sure to save this address in order to verify it.
13. Verify Policy ```npx hardhat verify 0x70d42aDAEB874A22F391d8c2E5ecd7dcace5393b --network polygon GNOSIS_SAFE_ADDR```
14. Update Token data on deployToken.ts
    1. ```
       const deployer = new ethers.Wallet(PRIVATE_KEY, ethers.provider)
         const amount = ethers.utils.parseUnits('500000000', 'ether') // AMOUNT OF TOKENS TO EMIT

         console.log('deployer', deployer.address)

         const token = await new contracts.Token__factory(deployer).deploy(
           ADMIN_ACCOUNT, 
           'Mokens League', // TOKEN NAME
           'MOKA', // TOKEN SYMBOL
           amount,
           forwarderAddress,
           policyAddress
         )
       }
       ```
15. Run ERC-20 Deploy Script
    1. ```
       npx hardhat run scripts/deployToken.ts --network polygon
       No need to generate any newer typings.
       Forwarder address? FORWARDER_ADDR
       Policy address? POLICY_ADDR

       ```
16. Verify Token ```npx hardhat verify TOKEN_ADDR --network polygon GNOSIS_SAFE_ADDR "Mokens League" MOKA 500000000000000000000000000 FORWARDER_ADDR POLICY_ADDR```

## Deployment Procedure - ERC721Upgradable (MokensNFT) and NFTSeller

1. git checkout main
2. run ```npx hardhat compile```
3. Get Free EtherScan API Key [(here)](https://info.etherscan.com/api-keys/)
4. Get Infura PROJECT ID & RPC LINKS [(here)](https://ethereumico.io/knowledge-base/infura-api-key-guide/)
5. Setup hardhat.config.ts with infura RPC links
6. Setup a deployer address.
7. Fund deployer address and make sure it has enough balance in order to deploy all contracts.
8. Setup Mainnet Gnosis Safe with required owners addresses
9. Setup environment variables .env

   1. ```
      ETHERSCAN_API_KEY = https://info.etherscan.com/api-keys/
      INFURA_PROJECT_ID = https://ethereumico.io/knowledge-base/infura-api-key-guide/
      PRIVATE_KEY = DEPLOYER_PRIVATE_ADDR
      ADMIN_ACCOUNT = GNOSIS_SAFE_ADDR# Often is a Gnosis-Safe wallet
      MINTER_ACCOUNT = GNOSIS_SAFE_ADDR# Can be the admin account
      PRIVATE_KEY = DEPLOYER_PRIVATE_ADDR
      PUBLIC = DEPLOYER_PRIVATE_ADDR
      SERVICE_ACCOUNT = GNOSIS_SAFE_ADDR
      VAULT_ADDRESS = GNOSIS_SAFE_ADDR
      PAYMENT_METHODS_TOKENS = "MOKA_TOKEN_ADDR, USDT_TOKEN" # add tokens list (comma separated)
      PAYMENT_METHODS_PRICES = "50, 100" # add prices per token (comma separated)
      PAYMENT_METHODS_DECIMALS = "18, 18" # add decimals per token (comma separated)
      PAYMENT_METHODS_DISCOUNTS = "0.01, 0" # add discount per token (comma separated)

      ```
10. Deploy PaymentMethods.sol

    1. ```
       npx hardhat run scripts/deployPaymentMethods.ts --network poliygon
       No need to generate any newer typings. 
       Oracle/Price Updater address? PRICE_UPDATER_ADD 
       Forwarder address? FORWARDER_ADDR
       ```
11. Modify scripts/verifyPaymentMethods.ts and fill out all parameters.

    1. ```
       module.exports = [
          "GNOSIS_SAFE_ADDR",
          "GNOSIS_SAFE_ADDR",
          [PAYMENT_METHODS_TOKENS],
          [PAYMENT_METHODS_PRICES],
          [PAYMENT_METHODS_DECIMALS],
          [PAYMENT_METHODS_DISCOUNTS],
          "FORWARDER_ADDR",
       ];
       ```
12. Verify PaymentMethods ```npx hardhat verify --constructor-args scripts/verifyPaymentMethods.ts PAYMENT_METHODS_ADDR --network polygon```
13. Deploy NFT Contract

    1. ```
       npx hardhat run scripts/deployNFT.ts --network polygon
       No need to generate any newer typings.
       NFT Name? MokensNFT
       NFT Symbol? MOKENS
       baseTokenURI ? https://mokensleague.com/meta/
       Forwarder address? FORWARDER_ADDR
       Policy address? POLICY_ADDR

       ```
14. Verify NFT Smart Contract

    1. ```
       npx hardhat verify NFT_PROXY_ADDR --network polygon FORWARDER_ADDR

       ```
15. Deploy NFTSeller

    1. ```
       npx hardhat run scripts/deployNFTSeller.ts --network polygon
       No need to generate any newer typings.
       NFT Contract Address? NFT_PROXY_ADDR
       authorizedMetaSigner? AWS_BACKEND_META_SIGNER_ADDR
       PaymentMethods Contract ? PAYMENT_METHODS_ADDR
       Forwarder address? FORWARDER_ADDR

       ```
16. Verify NFTSeller

    1. ```
       npx hardhat verify NFTSeller_PROXY_ADDR --network polygon FORWARDER_ADDR
       ```

## Upgrade Procedure - ERC721Upgradable (MokensNFT)

After Creating New Implementations or Versions of Upgradables .sol follow the next steps. This example applies to MokensNFT.sol.. the same procedure applies to all upgradable contracts. Please adapt upgrade script to the ERC721Upgradable Contract you need to upgrade.

*Assuming no new variables are added.

```
npx hardhat run scripts/upgradeNFT.ts --network goerli
No need to generate any newer typings.
Proxy Address? 0x7565CfA90E5fc8B1D40a6CFF6a8cD3840991a519

0x7565CfA90E5fc8B1D40a6CFF6a8cD3840991a519 original NFT(proxy) address
upgrade to NftV2...
0x7565CfA90E5fc8B1D40a6CFF6a8cD3840991a519 NFT V2 address(should be the same)
0xNEWImplementationADDR getImplementationAddress
0x47bB88D566639fcBC6A42D81252552C5bcBe0304 getAdminAddress
deployer 0x8b191c7eBD69Ea6c7a1584e7F299571236566Bea
```

## Testing & Code Coverage

You can run test with ```npx hardhat test```.

### Coverage

1. First run your python web server in port 8080 ```python3 -m http.server 8000 --directory coverage```
2. Then run ```npx hardhat coverage```
