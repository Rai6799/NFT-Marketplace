import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";
import * as contracts from "../typechain";
import { parseUnits } from "./utils";
import { expect } from "chai";
import { ContractFactory } from "ethers";

type Signers =
  | "deployer"
  | "admin"
  | "minter"
  | "holder"
  | "oracle"
  | "service"
  | "vault"
  | "thirdparty";

describe("NFT", function () {
  let signers: {
    [key in Signers]: SignerWithAddress;
  };
  let forwarder: contracts.MinimalForwarder;
  let policy: contracts.Policy;
  let tokens: {
    ARS: contracts.Token;
    USD: contracts.Token;
    WMATIC: contracts.Token;
    WETH: contracts.Token;
  };
  let paymentMethods: contracts.PaymentMethods;
  let nft: contracts.MokensNFT;
  let seller : contracts.NFTSeller;
  const tokenHashes = [...new Array(5)].map(() => ethers.utils.randomBytes(32));

  before(async function () {
    const [
      deployer,
      admin,
      minter,
      holder,
      oracle,
      vault,
      service,
      thirdparty,
    ] = await ethers.getSigners();
    signers = {
      deployer,
      admin,
      minter,
      holder,
      vault,
      oracle,
      service,
      thirdparty,
    };
    forwarder = await new contracts.MinimalForwarder__factory(deployer).deploy(
      "ForwaderName",
      "ForvarderVersion"
    );
    policy = await new contracts.Policy__factory(deployer).deploy(
      admin.address
    );

    tokens = {
      ARS: await new contracts.Token__factory(deployer).deploy(
        admin.address,
        "ARS",
        "ARS",
        ethers.utils.parseUnits("1000000", 18),
        forwarder.address,
        policy.address
      ),
      USD: await new contracts.Token__factory(deployer).deploy(
        admin.address,
        "USD",
        "USD",
        ethers.utils.parseUnits("1000000", 18),
        forwarder.address,
        policy.address
      ),
      WMATIC: await new contracts.Token__factory(deployer).deploy(
        admin.address,
        "WMATIC",
        "WMATIC",
        ethers.utils.parseUnits("1000000", 18),
        forwarder.address,
        policy.address
      ),
      WETH: await new contracts.Token__factory(deployer).deploy(
        admin.address,
        "WETH",
        "WETH",
        ethers.utils.parseUnits("1000000", 18),
        forwarder.address,
        policy.address
      ),
    };
    paymentMethods = await new contracts.PaymentMethods__factory(
      deployer
    ).deploy(
      admin.address,
      oracle.address,
      [tokens.ARS.address],
      [ethers.utils.parseUnits("1", 18)],
      [18],
      [parseUnits(0.01, 18)],
      forwarder.address
    );
    /*
    nft = await new contracts.MokensNFT__factory(deployer).deploy(
      "MokensNFT",
      "MOKS",
      "https://mokensleague.io/meta/",
      admin.address,
      minter.address,
      policy.address,
      forwarder.address
    );
    */

    nft = (await upgrades.deployProxy(
      await new contracts.MokensNFT__factory(deployer),
      [
        "MokensNFT",
        "MOKS",
        "https://mokensleague.io/meta/",
        admin.address,
        minter.address,
        policy.address,
        forwarder.address,
      ],
      {
        constructorArgs: [forwarder.address],
      }
    )) as contracts.MokensNFT;

    /* seller = await new contracts.NFTSeller__factory(deployer).deploy(
      admin.address,
      service.address,
      nft.address,
      paymentMethods.address,
      service.address,
      vault.address,
      forwarder.address
    );*/
    seller = (await upgrades.deployProxy(
      await new contracts.NFTSeller__factory(deployer),
      [
        admin.address,
        service.address,
        nft.address,
        paymentMethods.address,
        service.address,
        vault.address,
        forwarder.address,
      ],
      { constructorArgs: [forwarder.address] }
    )) as contracts.NFTSeller;
  });

  describe("NFT", () => {
    const tokenHash = tokenHashes[0];
    it("only minter can mint", async () => {
      await expect(
        nft
          .connect(signers.thirdparty)
          .mint(signers.thirdparty.address, tokenHash)
      ).to.be.reverted;
      await nft
        .connect(signers.minter)
        .mint(signers.thirdparty.address, tokenHash);
    });
    it("can't mint same hash twice", async () => {
      await expect(
        nft.connect(signers.minter).mint(signers.thirdparty.address, tokenHash)
      ).to.be.revertedWith("Token hash already exists");
    });
    it("search existing token by hash", async () => {
      expect(
        await nft.connect(signers.thirdparty).tokenIdByHash(tokenHash)
      ).to.eq(1);
    });
    it("search existing token by id", async () => {
      expect(await nft.connect(signers.thirdparty).tokenHashById(1)).to.eq(
        ethers.utils.hexlify(tokenHash)
      );
    });
    it("search for non-existing token by hash", async () => {
      await expect(
        nft
          .connect(signers.thirdparty)
          .tokenIdByHash(ethers.utils.randomBytes(32))
      ).to.be.revertedWith("Unknow token");
    });
    it("search for non-existing token by id", async () => {
      await expect(
        nft.connect(signers.thirdparty).tokenHashById(99)
      ).to.be.revertedWith("Unknow token");
    });
    it("mint in batch", async () => {
      const tokenHashesBatch = [...new Array(5)].map(() =>
        ethers.utils.randomBytes(32)
      );
      await nft
        .connect(signers.minter)
        .mintBatch(signers.thirdparty.address, tokenHashesBatch);
      expect(
        await nft.connect(signers.thirdparty).tokenIdByHash(tokenHashesBatch[0])
      ).to.eq(2);
      expect(
        await nft.connect(signers.thirdparty).tokenIdByHash(tokenHashesBatch[1])
      ).to.eq(3);
      expect(
        await nft.connect(signers.thirdparty).tokenIdByHash(tokenHashesBatch[2])
      ).to.eq(4);

      expect(
        await nft.connect(signers.thirdparty).tokenIdByHash(tokenHashesBatch[3])
      ).to.eq(5);
      expect(
        await nft.connect(signers.thirdparty).tokenIdByHash(tokenHashesBatch[4])
      ).to.eq(6);
    });
    it("Check if a blacklisted address can mint", async () => {
      const blackistedAddress = await ethers.Wallet.createRandom();
      await policy
        .connect(signers.admin)
        .setBlacklistForAccount(blackistedAddress.address, true);

      await expect(
        // mint a token
        nft
          .connect(signers.minter)
          .mint(blackistedAddress.address, ethers.utils.randomBytes(32))
      ).to.be.revertedWith("Can't transfer");
    });
    it("give approval to a operator", async () => {
      await nft
        .connect(signers.holder)
        .setApprovalForAll(signers.service.address, true);
      expect(
        await nft.isApprovedForAll(
          signers.holder.address,
          signers.service.address
        )
      ).to.be.true;
    });
    it("revoke approval to a operator", async () => {
      await nft
        .connect(signers.holder)
        .setApprovalForAll(signers.service.address, false);
      expect(
        await nft.isApprovedForAll(
          signers.holder.address,
          signers.service.address
        )
      ).to.be.false;
    });
    it("change nft forwarder address", async () => {
      const newforwarder = await new contracts.MinimalForwarder__factory(
        signers.deployer
      ).deploy("ForwaderName", "ForvarderVersion");
      await nft.connect(signers.admin).updateForwarder(newforwarder.address);

      expect(await nft.forwarder()).to.not.eq(forwarder.address);
    });
    it("change nft policy address", async () => {
      const newPolicy = await new contracts.Policy__factory(
        signers.deployer
      ).deploy(signers.admin.address);
      await nft.connect(signers.admin).updatePolicy(newPolicy.address);
      expect(await nft.policy()).to.not.eq(policy.address);
    });
    it("change nft baseTokenURI", async () => {
      await nft
        .connect(signers.admin)
        .updateBaseURI("https://mokensleague.com/nft/");
      expect(await nft.connect(signers.thirdparty).tokenURI(1)).to.eq(
        "https://mokensleague.com/nft/1"
      );
    });
    it("check supported interfaces", async () => {
      expect(await nft.supportsInterface("0x01ffc9a7")).to.be.true;
    });
  });
  describe("Seller", () => {
    it("add lootbox stock", async () => {
      await seller
        .connect(signers.admin)
        .addLootbox(ethers.utils.parseUnits("1", 18), tokenHashes.slice(1, 3));
    });
    it("buy a token", async () => {
      const minterRole = ethers.utils.solidityKeccak256(
        ["string"],
        ["MINTER_ROLE"]
      );
      await nft.connect(signers.admin).grantRole(minterRole, seller.address);
      await tokens.ARS.connect(signers.admin).transfer(
        signers.holder.address,
        ethers.utils.parseUnits("100", 18)
      );
      await tokens.ARS.connect(signers.holder).approve(
        seller.address,
        ethers.utils.parseUnits("100", 18)
      );
      await expect(() =>
        seller
          .connect(signers.holder)
          .buyAvailableLootbox(0, tokens.ARS.address)
      ).to.changeTokenBalance(tokens.ARS, signers.vault, parseUnits(0.99, 18));
    });
    it("remove discount and buy another token", async () => {
      await paymentMethods
        .connect(signers.oracle)
        .updatePaymentMethod(
          tokens.ARS.address,
          parseUnits(2, 18),
          parseUnits(0, 18)
        );
      await expect(() =>
        seller
          .connect(signers.holder)
          .buyAvailableLootbox(0, tokens.ARS.address)
      ).to.changeTokenBalance(tokens.ARS, signers.vault, parseUnits(2, 18));
    });
    it("buy a token with no stock available", async () => {
      await expect(
        seller
          .connect(signers.holder)
          .buyAvailableLootbox(0, tokens.ARS.address)
      ).to.be.revertedWith("No available stock");
    });
    it("add token hash to lootbox", async () => {
      const tokenHashesBatch = [...new Array(4)].map(() =>
        ethers.utils.randomBytes(32)
      );
      await seller
        .connect(signers.service)
        .addTokensHashToLootbox(0, tokenHashesBatch);
      expect(
        await (
          await seller.connect(signers.thirdparty).lootboxes(0)
        ).appendIndex
      ).to.eq(6);
    });
    it("buy metalootbox", async () => {
      const tokenHash = ethers.utils.randomBytes(32);
      const price = parseUnits(1, 18);
      const payloadHash = ethers.utils.solidityKeccak256(
        ["uint256", "bytes32"],
        [price, tokenHash]
      );
      const signature = await signers.service.signMessage(
        ethers.utils.arrayify(payloadHash)
      );
      await expect(() =>
        seller
          .connect(signers.holder)
          .buyMetaLootbox(price, tokenHash, tokens.ARS.address, signature)
      ).to.changeTokenBalance(tokens.ARS, signers.vault, parseUnits(2, 18));
    });
    it("buy metalootbox with incorrectp signer", async () => {
      const tokenHash = ethers.utils.randomBytes(32);
      const price = parseUnits(1, 18);
      const payloadHash = ethers.utils.solidityKeccak256(
        ["uint256", "bytes32"],
        [price, tokenHash]
      );
      const signature = await signers.holder.signMessage(
        ethers.utils.arrayify(payloadHash)
      );
      await expect(
        seller
          .connect(signers.holder)
          .buyMetaLootbox(price, tokenHash, tokens.ARS.address, signature)
      ).to.be.revertedWith("Invalid signer");
    });
    it("buy a token with a token that can't be transfered", async () => {
      await tokens.ARS.connect(signers.holder).approve(
        seller.address,
        ethers.utils.parseUnits("0", 18)
      );
      await expect(
        seller
          .connect(signers.holder)
          .buyAvailableLootbox(0, tokens.ARS.address)
      ).to.be.reverted;
    });
    it("add token hash to a non existing lootbox", async () => {
      await expect(
        seller
          .connect(signers.service)
          .addTokensHashToLootbox(99, [ethers.utils.randomBytes(32)])
      ).to.be.revertedWith("Lootbox not exist");
    });
    it("update lootbox price", async () => {
      await seller
        .connect(signers.admin)
        .updateLootboxPrice(0, ethers.utils.parseUnits("200", 18));
    });
    it("update lootbox price of a non existing lootbox", async () => {
      await expect(
        seller
          .connect(signers.admin)
          .updateLootboxPrice(99, ethers.utils.parseUnits("2", 18))
      ).to.be.revertedWith("Lootbox not exist");
    });
    it("buy lootbox with a non existing payment method", async () => {
      await expect(
        seller
          .connect(signers.holder)
          .buyAvailableLootbox(0, tokens.WMATIC.address)
      ).to.be.revertedWith("Payment method not available");
    });
    it("claim seller contract token funds", async () => {
      await tokens.ARS.connect(signers.admin).transfer(
        signers.holder.address,
        ethers.utils.parseUnits("300", 18)
      );
      await tokens.ARS.connect(signers.holder).approve(
        seller.address,
        ethers.utils.parseUnits("300", 18)
      );
      await tokens.ARS.connect(signers.holder).transfer(
        seller.address,
        ethers.utils.parseUnits("300", 18)
      );
      await expect(() =>
        seller.connect(signers.admin).claimTokens([tokens.ARS.address])
      ).to.changeTokenBalances(
        tokens.ARS,
        [seller, signers.vault],
        [parseUnits(-300, 18), parseUnits(300, 18)]
      );
    });
    it("buy a lootbox with native", async () => {
      await paymentMethods
        .connect(signers.admin)
        .addPaymentMethod(
          ethers.constants.AddressZero,
          ethers.utils.parseUnits("0.005", 18),
          18,
          0
        );
      await expect(() =>
        seller
          .connect(signers.holder)
          .buyAvailableLootbox(0, ethers.constants.AddressZero, {
            value: ethers.utils.parseUnits("1", 18),
          })
      ).to.changeEtherBalance(signers.vault, parseUnits(1, 18));
    });
    it("buy a lootbox with native but no funds", async () => {
      await expect(
        seller
          .connect(signers.holder)
          .buyAvailableLootbox(0, ethers.constants.AddressZero, {
            value: ethers.utils.parseUnits("0.5", 18),
          })
      ).to.be.revertedWith("Not enough funds transferred");
    });
    it("withdraw seller contract token funds native", async () => {
      await expect(
        seller
          .connect(signers.admin)
          .claimTokens([ethers.constants.AddressZero])
      ).to.not.reverted;
    });
    it("change seller forwarder address", async () => {
      const newforwarder = await new contracts.MinimalForwarder__factory(
        signers.deployer
      ).deploy("ForwaderName", "ForvarderVersion");
      await seller.connect(signers.admin).updateForwarder(newforwarder.address);
      expect(await seller.forwarder()).to.not.eq(forwarder.address);
    });
    it("change seller payment method address", async () => {
      const newPaymentMethod = await new contracts.PaymentMethods__factory(
        signers.deployer
      ).deploy(
        signers.admin.address,
        signers.oracle.address,
        [tokens.WMATIC.address],
        [ethers.utils.parseUnits("1", 18)],
        [18],
        [parseUnits(0.01, 18)],
        forwarder.address
      );
      await seller
        .connect(signers.admin)
        .updatePaymentMethods(newPaymentMethod.address);
      expect(await seller.paymentMethods()).to.not.eq(paymentMethods.address);
    });
    it("change seller vault address", async () => {
      const newVault = await ethers.Wallet.createRandom();
      await seller.connect(signers.admin).updateVault(newVault.address);
      expect(await seller.vault()).to.not.eq(signers.vault.address);
    });
    it("change seller metasigner address", async () => {
      const newAuthorizedMetaSigner = await ethers.Wallet.createRandom();
      await seller
        .connect(signers.admin)
        .updateAuthorizedMetaSigner(newAuthorizedMetaSigner.address);
      expect(await seller.authorizedMetaSigner()).to.not.eq(
        signers.service.address
      );
    });
  });
  describe("Payment methods", () => {
    it("add single payment method", async () => {
      await paymentMethods
        .connect(signers.admin)
        .addPaymentMethod(
          tokens.USD.address,
          parseUnits(1, 18),
          parseUnits(0.5, 18),
          parseUnits(0.01, 18)
        );
      const paymentMethod = await paymentMethods
        .connect(signers.holder)
        .paymentMethodAvailable(tokens.USD.address);
      expect(paymentMethod).to.be.true;
    });
    it("disable a single payment method", async () => {
      await paymentMethods
        .connect(signers.admin)
        .updatePaymentMethodStatus(tokens.USD.address, false);
      const paymentMethod = await paymentMethods
        .connect(signers.holder)
        .paymentMethodAvailable(tokens.USD.address);
      expect(paymentMethod).to.be.false;
    });
    it("remove a single payment method", async () => {
      await paymentMethods
        .connect(signers.admin)
        .updatePaymentMethodStatus(tokens.USD.address, true);

      await paymentMethods
        .connect(signers.admin)
        .removePaymentMethodStatus(tokens.USD.address);
      const paymentMethod = await paymentMethods
        .connect(signers.holder)
        .paymentMethodAvailable(tokens.USD.address);
      expect(paymentMethod).to.be.false;
    });
    it("add several payment methods", async () => {
      await paymentMethods
        .connect(signers.admin)
        .addPaymentMethods(
          [tokens.WMATIC.address, tokens.WETH.address],
          [parseUnits(1, 18), parseUnits(1, 18)],
          [parseUnits(0.5, 18), parseUnits(0.5, 18)],
          [parseUnits(0.01, 18), parseUnits(0.01, 18)]
        );
      const paymentMethod = await paymentMethods
        .connect(signers.holder)
        .paymentMethodAvailable(tokens.WMATIC.address);
      expect(paymentMethod).to.be.true;
      const paymentMethod2 = await paymentMethods
        .connect(signers.holder)
        .paymentMethodAvailable(tokens.WETH.address);
      expect(paymentMethod2).to.be.true;
    });
    it("add several payment methods with invalid params length", async () => {
      await expect(
        paymentMethods
          .connect(signers.admin)
          .addPaymentMethods(
            [tokens.WMATIC.address, tokens.WETH.address],
            [parseUnits(1, 18), parseUnits(1, 18)],
            [parseUnits(0.5, 18)],
            [parseUnits(0.01, 18)]
          )
      ).to.be.revertedWith("Invalid params length");
    });
    it("add payment method with already existing address", async () => {
      await expect(
        paymentMethods
          .connect(signers.admin)
          .addPaymentMethod(
            tokens.WMATIC.address,
            parseUnits(1, 18),
            parseUnits(0.5, 18),
            parseUnits(0.01, 18)
          )
      ).to.be.revertedWith("Payment method already exist");
    });
    it("update non existing payment method", async () => {
      await expect(
        paymentMethods
          .connect(signers.oracle)
          .updatePaymentMethod(
            "0x0000000000000000000000000000000000000001",
            parseUnits(1, 18),
            parseUnits(0.01, 18)
          )
      ).to.be.revertedWith("Payment method not exist");
    });
    it("remove non existing payment method", async () => {
      await expect(
        paymentMethods
          .connect(signers.admin)
          .removePaymentMethodStatus(
            "0x0000000000000000000000000000000000000001"
          )
      ).to.be.revertedWith("Payment not exist");
    });
    it("request a non existing payment method", async () => {
      await expect(
        paymentMethods
          .connect(signers.holder)
          .paymentMethod("0x0000000000000000000000000000000000000001")
      ).to.be.revertedWith("Payment method unavailable");
    });
    it("enable an already enabled payment method", async () => {
      await expect(
        paymentMethods
          .connect(signers.admin)
          .updatePaymentMethodStatus(tokens.ARS.address, true)
      ).to.be.revertedWith("Payment status not change");
    });
    it("update fowarder address", async () => {
      const newforwarder = await new contracts.MinimalForwarder__factory(
        signers.deployer
      ).deploy("ForwaderName", "ForvarderVersion");
      await paymentMethods
        .connect(signers.admin)
        .updateForwarder(newforwarder.address);
      expect(
        await paymentMethods.connect(signers.holder).forwarder()
      ).to.be.equal(newforwarder.address);
    });
  });
});
