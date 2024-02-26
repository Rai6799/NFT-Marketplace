import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { sign } from "crypto";
import { ContractTransaction } from "ethers";
import { ethers } from "hardhat";
import  * as contracts from "../typechain";
import { singMetatx } from "./utils";

describe("Token", function () {
  let signers: any = {}
  let forwarder: contracts.MinimalForwarder
  let token: contracts.Token
  let tokenMitable: contracts.TokenMintable
  let policy: contracts.Policy
  let operator: contracts.MockOperator
  
  before(async function(){
    const [deployer, admin, minter, holder, service, thirdparty] = await ethers.getSigners()
    signers = {
      deployer,
      admin,
      minter,
      holder,
      service,
      thirdparty
    }
    forwarder = await new contracts.MinimalForwarder__factory(deployer).deploy(
      'ForwaderName',
      'ForvarderVersion'
    )
    policy = await new contracts.Policy__factory(deployer).deploy(
      admin.address
    )
    operator = await new contracts.MockOperator__factory(deployer).deploy() 
    
    token = await new contracts.Token__factory(deployer).deploy(
      admin.address,
      "TokenName",
      "TokenSymbol",
      ethers.utils.parseUnits('100','ether'),
      forwarder.address,
      policy.address
    )
    await token.connect(admin).transfer(holder.address, ethers.utils.parseUnits('10', 'ether'))
    tokenMitable = await new contracts.TokenMintable__factory(deployer).deploy(
      minter.address,
      admin.address,
      "TokenName",
      "TokenSymbol",
      ethers.utils.parseUnits('100','ether'),
      forwarder.address,
      policy.address
    )
  })
  describe("Verify init values", () => {
    it("forwarder", async () => {
      const value = await token.forwarder()
      expect(value).to.be.eq(forwarder.address)
    })
    it("policy", async () => {
      const value = await token.policy()
      expect(value).to.be.eq(policy.address)
    })
    it("defaultOperators", async () => {
      const value = await token.defaultOperators()
      expect(value.length).to.be.eq(0)
    })
  })
  describe("Update attributes", function() {
    describe("updateForwarder", () => {
      let tx: (s:SignerWithAddress) => Promise<ContractTransaction>
      let localForwarder: contracts.MinimalForwarder
      before(async () => {
        localForwarder = await new contracts.MinimalForwarder__factory(signers.deployer).deploy(
          'ForwaderName',
          'ForvarderVersion'
        )
        tx = (signer: SignerWithAddress) => token.connect(signer).updateForwarder(localForwarder.address)
      })
      it("thirdparty should fail", async () => {
        await expect(
          tx(signers.thirdparty)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
      it("owner should succeed", async () => {
        await expect(tx(signers.admin))
          .to.emit(token, 'ForwarderUpdated')
          .withArgs(localForwarder.address);

        const current = await token.forwarder()
        expect(current).to.be.eq(localForwarder.address)
      })
      after(() => 
        token.connect(signers.admin).updateForwarder(forwarder.address)
      )
    })
    describe("updatePolicy", () => {
      let tx: (s:SignerWithAddress) => Promise<ContractTransaction>
      let localPolicy: contracts.Policy
      before(async () => {
        localPolicy = await new contracts.Policy__factory(signers.deployer).deploy(
          signers.admin.address
        )
        tx = (signer: SignerWithAddress) => token.connect(signer).updatePolicy(localPolicy.address)
      })
      it("thirdparty should fail", async () => {
        await expect(
          tx(signers.thirdparty)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
      it("owner should succeed", async () => {
        const previous = await token.policy()
        
        await expect(tx(signers.admin))
          .to.emit(token, 'PolicyUpdated')
          .withArgs(localPolicy.address);

        const updated = await token.policy()
        expect(updated).to.be.not.eq(previous)
      })
      after(() => token.connect(signers.admin).updatePolicy(policy.address))
    })
  })
  describe("Forwarder", function () {
    before(async function(){
    })
    it("should be possible to execute MetaTX", async () => {
      const data = token.interface.encodeFunctionData("transfer", [
        signers.holder.address,
        ethers.utils.parseUnits('1', 'ether')
      ])
      const gas = await ethers.provider.estimateGas({
        from: signers.holder.address,
        to: token.address,
        data
      })
      const network = await ethers.provider.getNetwork()
      const request = {
        from: signers.holder.address,
        to: token.address,
        value: 0,
        nonce: 0,
        gas: gas.toNumber(),
        data
      }
      const signature = await singMetatx(signers.holder.address, {
          chainId: network.chainId,
          name: 'ForwaderName',
          version: 'ForvarderVersion',
          verifyingContract: forwarder.address
      }, request)
      await forwarder.connect(signers.service).execute(request, signature)
    })
    it("invalid signature should should fail", async () => {
      const data = token.interface.encodeFunctionData("transfer", [
        signers.holder.address,
        ethers.utils.parseUnits('1', 'ether')
      ])
      const gas = await ethers.provider.estimateGas({
        from: signers.holder.address,
        to: token.address,
        data
      })
      const network = await ethers.provider.getNetwork()
      const request = {
        from: signers.holder.address,
        to: token.address,
        value: 0,
        nonce: 1,
        gas: gas.toNumber(),
        data
      }
      const signature = await singMetatx(signers.thirdparty.address, {
          chainId: network.chainId,
          name: 'ForwaderName',
          version: 'ForvarderVersion',
          verifyingContract: forwarder.address
      }, request)
      await expect(forwarder.connect(signers.service).execute(request, signature)).to.be.revertedWith('MinimalForwarder: signature does not match request')
    })
    it("nonce shoul be updated", async () => {
      const nonce = await forwarder.getNonce(signers.holder.address)
      expect(nonce).to.be.eq(1)
    })
    it("should be possible to update forwarder and call MetaTX", async () => {
      const localForwarder = await new contracts.MinimalForwarder__factory(signers.deployer).deploy(
        'ForwaderName2',
        'ForvarderVersion2'
      )
      const amount = ethers.utils.parseUnits('1', 'ether')
      await token.connect(signers.admin).updateForwarder(localForwarder.address)
      const data = token.interface.encodeFunctionData("transfer", [
        signers.thirdparty.address,
        amount
      ])
      const gas = await ethers.provider.estimateGas({
        from: signers.holder.address,
        to: token.address,
        data
      })
      const network = await ethers.provider.getNetwork()
      const request = {
        from: signers.holder.address,
        to: token.address,
        value: 0,
        nonce: 0,
        gas: gas.toNumber(),
        data
      }
      const signature = await singMetatx(signers.holder.address, {
          chainId: network.chainId,
          name: 'ForwaderName2',
          version: 'ForvarderVersion2',
          verifyingContract: localForwarder.address
      }, request)
      await token.connect(signers.admin).updateForwarder(localForwarder.address)
      await expect(
        localForwarder.connect(signers.service).execute(request, signature)
      ).to.be.emit(token, 'Transfer').withArgs(signers.holder.address, signers.thirdparty.address, amount)
    })
  })
  describe("Policy", function(){
    describe("Blacklist", () => {
      it("thirdparty should not blacklist accounts", async () => {
        await expect(
          policy.connect(signers.thirdparty).setBlacklistForAccount(signers.holder.address, true)
        ).to.be.revertedWith('Ownable: caller is not the owner')
      })
      it("admin should add blacklisted account", async () => {
        await expect(
          policy.connect(signers.admin).setBlacklistForAccount(signers.holder.address, true)
        ).to.be.emit(policy, 'Blacklist').withArgs(signers.holder.address, true)
      })
      it("Transfer to balcklisted address should fail", async () => {
        await expect(
          token.connect(signers.holder).transfer(signers.thirdparty.address, ethers.utils.parseUnits('1','ether'))
        ).to.be.revertedWith('No transferable')
      })
      it("Transfer to unbalcklisted address should succeed", async () => {
        const amount = ethers.utils.parseUnits('1','ether')
        await expect(
          policy.connect(signers.admin).setBlacklistForAccount(signers.holder.address, false)
        ).to.be.emit(policy, 'Blacklist').withArgs(signers.holder.address, false)
        await expect(
          token.connect(signers.holder).transfer(signers.thirdparty.address, amount)
          ).to.be.emit(token, 'Transfer').withArgs(signers.holder.address, signers.thirdparty.address, amount)
      })
    })
    describe("CoreContracts", () => {
      let localOperator: contracts.MockOperator
      before(async () => {
        localOperator = await new contracts.MockOperator__factory(signers.deployer).deploy() 
      })
      it("thirdparty should not add a corecontract", async () => {
        await expect(
          policy.connect(signers.thirdparty).setCoreContract(localOperator.address, true)
        ).to.be.revertedWith('Ownable: caller is not the owner')
      })
      it("admin should should add a corecontract", async () => {
        await expect(
          policy.connect(signers.admin).setCoreContract(localOperator.address, true)
        ).to.be.emit(policy, 'CoreContract').withArgs(localOperator.address, true)
      })
      it("operate from a new corecontract should succeed", async () => {
        const args = [signers.holder.address, signers.thirdparty.address, ethers.utils.parseUnits('0.1', 'ether')]
        await expect(
          //@ts-ignore
          localOperator["operate(address,address,address,uint256)"](token.address, ...args)
        ).to.be.emit(token, 'Transfer')
        .withArgs(...args)
      })
      it("operate from a removed corecontract should fail", async () => {
        const args = [signers.holder.address, signers.thirdparty.address, ethers.utils.parseUnits('0.1', 'ether')]
        await expect(
          policy.connect(signers.admin).setCoreContract(localOperator.address, false)
        ).to.be.emit(policy, 'CoreContract').withArgs(localOperator.address, false)
        await expect(
          //@ts-ignore
          localOperator["operate(address,address,address,uint256)"](token.address, ...args)
        ).to.be.revertedWith('ERC777: caller is not an operator for holder')
      })
    })
  })
  describe("TokenMintable", function(){
    it('Mint by thirdparty should fail', async () => {
      await expect(
        tokenMitable.connect(signers.thirdparty)["mint(address,uint256)"](signers.holder.address, ethers.utils.parseUnits('1', 'ether'))
      ).to.be.revertedWith('AccessControl: account 0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6')
    })
    it('Mint by owner should succeed', async () => {
      await expect(
        tokenMitable.connect(signers.minter)["mint(address,uint256)"](signers.holder.address, ethers.utils.parseUnits('1', 'ether'))
      ).to.be.emit(tokenMitable, 'Minted')
      .withArgs(signers.minter.address, signers.holder.address, ethers.utils.parseUnits('1', 'ether'), "0x", "0x")
    })
    it('Give minter role to a new account should be possible', async () => {
      const minterRole = ethers.utils.solidityKeccak256(['string'],['MINTER_ROLE'])
      await expect(
        tokenMitable.connect(signers.admin).grantRole(minterRole, signers.thirdparty.address)
      ).to.be.emit(tokenMitable, 'RoleGranted')
        .withArgs(minterRole, signers.thirdparty.address, signers.admin.address)
      await expect(
        tokenMitable.connect(signers.thirdparty)["mint(address,uint256)"](signers.holder.address, ethers.utils.parseUnits('1', 'ether'))
      ).to.be.emit(tokenMitable, 'Minted')
    })
  })
})