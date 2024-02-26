import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";
import * as contracts from "../typechain";
import { parseUnits } from "./utils";
import { expect } from "chai";
import { BigNumberish } from "ethers";

type Signers =
  | "deployer"
  | "admin"
  | "minter"
  | "holder1"
  | "holder2"
  | "oracle"
  | "service"
  | "vault"
  | "thirdparty";

describe("Marketplace", () => {
  let signers: { [key in Signers]: SignerWithAddress };
  let forwarder: contracts.MinimalForwarder;
  let policy: contracts.Policy;
  let tokens: {
    MOKA: contracts.Token;
    USDT: contracts.Token;
    WETH: contracts.Token;
  };
  let paymentMethods: contracts.PaymentMethods;
  let mokensNFT: contracts.MokensNFT;
  let marketplace: contracts.Marketplace;
  let seller: contracts.NFTSeller;
  const tokenHashes = [...new Array(10)].map(() =>
    ethers.utils.randomBytes(32)
  );

  before(async () => {
    const [
      deployer,
      admin,
      minter,
      holder1,
      holder2,
      oracle,
      service,
      vault,
      thirdparty,
    ] = await ethers.getSigners();

    signers = {
      deployer,
      admin,
      minter,
      holder1,
      holder2,
      oracle,
      service,
      vault,
      thirdparty,
    };

    //create a forwarder
    forwarder = await new contracts.MinimalForwarder__factory(deployer).deploy(
      "Forwarder",
      "ForwarderVersion"
    );
    policy = await new contracts.Policy__factory(deployer).deploy(
      admin.address
    );
    tokens = {
      MOKA: await new contracts.Token__factory(deployer).deploy(
        admin.address,
        "MOKA",
        "MOKA",
        ethers.utils.parseUnits("1000000", 18),
        forwarder.address,
        policy.address
      ),
      USDT: await new contracts.Token__factory(deployer).deploy(
        admin.address,
        "USDT",
        "USDT",
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
      [tokens.MOKA.address, tokens.USDT.address, ethers.constants.AddressZero],
      [
        ethers.utils.parseUnits("0.5", 18),
        ethers.utils.parseUnits("1", 18),
        ethers.utils.parseUnits("2", 18),
      ],
      [18, 18, 18],
      [parseUnits(0.1, 18), parseUnits(0, 18), parseUnits(0, 18)],
      forwarder.address
    );
    /*
    mokensNFT = await new contracts.MokensNFT__factory(deployer).deploy(
      "MokensNFT",
      "MOKS",
      "https://mokensleague.io/meta/",
      admin.address,
      minter.address,
      policy.address,
      forwarder.address
    );
    */
    mokensNFT = (await upgrades.deployProxy(
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

    /*
    seller = await new contracts.NFTSeller__factory(deployer).deploy(
      admin.address,
      service.address,
      mokensNFT.address,
      paymentMethods.address,
      service.address,
      vault.address,
      forwarder.address
    );
    */
    seller = (await upgrades.deployProxy(
      await new contracts.NFTSeller__factory(deployer),
      [
        admin.address,
        service.address,
        mokensNFT.address,
        paymentMethods.address,
        service.address,
        vault.address,
        forwarder.address,
      ],
      { constructorArgs: [forwarder.address] }
    )) as contracts.NFTSeller;
    /*
    marketplace = await new contracts.Marketplace__factory(deployer).deploy(
      admin.address,
      mokensNFT.address,
      paymentMethods.address,
      vault.address,
      forwarder.address,
      400
    );
    */
    marketplace = (await upgrades.deployProxy(
      await new contracts.Marketplace__factory(deployer),
      [
        admin.address,
        mokensNFT.address,
        paymentMethods.address,
        vault.address,
        forwarder.address,
        400,
      ],
      { constructorArgs: [forwarder.address] }
    )) as contracts.Marketplace;
  });

  describe("Marketplace", () => {
    before(async () => {
      await policy
        .connect(signers.admin)
        .setCoreContract(marketplace.address, true);
      await seller
        .connect(signers.admin)
        .addLootbox(ethers.utils.parseUnits("100", 18), tokenHashes);
      const minterRole = ethers.utils.solidityKeccak256(
        ["string"],
        ["MINTER_ROLE"]
      );
      await mokensNFT
        .connect(signers.admin)
        .grantRole(minterRole, seller.address);
      await tokens.MOKA.connect(signers.admin).transfer(
        signers.holder1.address,
        ethers.utils.parseUnits("45", 18)
      );
      await tokens.MOKA.connect(signers.holder1).approve(
        seller.address,
        ethers.utils.parseUnits("45", 18)
      );
      await seller
        .connect(signers.holder1)
        .buyAvailableLootbox(0, tokens.MOKA.address);
    });

    it("create an offer", async () => {
      await expect(
        marketplace
          .connect(signers.holder1)
          .createSellOffer(1, ethers.utils.parseUnits("500", 18))
      )
        .to.emit(marketplace, "NewSellOffer")
        .withArgs(
          signers.holder1.address,
          1,
          ethers.utils.parseUnits("500", 18)
        );
    });
    it("create an existing offer", async () => {
      await expect(
        marketplace
          .connect(signers.holder1)
          .createSellOffer(1, ethers.utils.parseUnits("1000", 18))
      ).to.be.revertedWith("Offer already exist");
    });
    it("update an offer", async () => {
      await expect(
        marketplace
          .connect(signers.holder1)
          .updateOfferPrice(1, ethers.utils.parseUnits("1000", 18))
      )
        .to.emit(marketplace, "UpdateOfferPrice")
        .withArgs(1, ethers.utils.parseUnits("1000", 18));
    });
    it("update an offer with wrong tokenId", async () => {
      await expect(
        marketplace
          .connect(signers.holder1)
          .updateOfferPrice(99999, ethers.utils.parseUnits("2000", 18))
      ).to.be.revertedWith("Offer not exist");
    });
    it("invalid owner updating offer", async () => {
      await expect(
        marketplace
          .connect(signers.holder2)
          .updateOfferPrice(1, ethers.utils.parseUnits("2000", 18))
      ).to.be.revertedWith("Invalid sender");
    });
    it("taking an offer with an invalid payment method", async () => {
      await expect(
        marketplace.connect(signers.holder2).takeOffer(1, tokens.WETH.address)
      ).to.be.revertedWith("Payment method not available");
    });

    it("taking an offer without sufficient funds", async () => {
      await expect(
        marketplace.connect(signers.holder2).takeOffer(1, tokens.MOKA.address)
      ).to.be.reverted;

      await tokens.MOKA.connect(signers.admin).transfer(
        signers.holder2.address,
        ethers.utils.parseUnits("450", 18)
      );
      await tokens.MOKA.connect(signers.holder2).approve(
        marketplace.address,
        ethers.utils.parseUnits("435", 18)
      );
      await expect(
        marketplace.connect(signers.holder2).takeOffer(1, tokens.MOKA.address)
      ).to.be.reverted;
    });

    it("taking an offer", async () => {
      await tokens.MOKA.connect(signers.holder2).approve(
        marketplace.address,
        ethers.utils.parseUnits("450", 18)
      );
      await expect(
        marketplace.connect(signers.holder2).takeOffer(1, tokens.MOKA.address)
      )
        .to.emit(marketplace, "OfferTaken")
        .withArgs(1, tokens.MOKA.address, 0, ethers.utils.parseUnits("18", 18));
    });
    it("cancel an offer with wrong sender", async () => {
      await marketplace
        .connect(signers.holder2)
        .createSellOffer(1, ethers.utils.parseUnits("500", 18));
      await expect(
        marketplace.connect(signers.holder1).cancelOffer(1)
      ).to.be.revertedWith("Invalid sender");
    });
    it("cancel an offer", async () => {
      await expect(marketplace.connect(signers.holder2).cancelOffer(1))
        .to.emit(marketplace, "CancelOffer")
        .withArgs(1);
    });
    it("cancel an offer with wrong tokenId", async () => {
      await expect(
        marketplace.connect(signers.holder2).cancelOffer(99999)
      ).to.be.revertedWith("Offer not exist");
    });
    it("taking an invalid offer", async () => {
      await expect(
        marketplace.connect(signers.holder1).takeOffer(1, tokens.MOKA.address)
      ).to.be.revertedWith("Offer not exist");
    });
    it("taking an offer -  native with insufficient funds", async () => {
      await marketplace
        .connect(signers.holder2)
        .createSellOffer(1, ethers.utils.parseUnits("1500", 18));
      await expect(
        marketplace
          .connect(signers.holder1)
          .takeOffer(1, ethers.constants.AddressZero, {
            value: ethers.utils.parseUnits("1", 18),
          })
      ).to.be.revertedWith("Not enough funds transferred");
    });
    it("taking an offer with native funds", async () => {
      await expect(
        marketplace
          .connect(signers.holder1)
          .takeOffer(1, ethers.constants.AddressZero, {
            value: ethers.utils.parseUnits("3000", 18),
          })
      )
        .to.emit(marketplace, "OfferTaken")
        .withArgs(
          1,
          ethers.constants.AddressZero,
          0,
          ethers.utils.parseUnits("120", 18)
        );
    });
    it("Rental - should set user to holder2", async () => {
      const expires = Math.floor(new Date().getTime() / 1000) + 1000;
      await mokensNFT
        .connect(signers.holder1)
        .setUser(1, signers.holder2.address, BigInt(expires));

      const user = await mokensNFT.userOf(1);
      await expect(user).to.equal(signers.holder2.address);
    });
    it("Rental - owner should still be holder1", async () => {
      expect(await mokensNFT.ownerOf(1)).to.equal(signers.holder1.address);
    });
    it("Rental - should not be expired", async () => {
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;
      expect((await mokensNFT.userExpires(1)).toNumber()).to.be.greaterThan(
        timestampBefore
      );
    });
    it("update marketplace forwader", async () => {
      const newforwarder = await new contracts.MinimalForwarder__factory(
        signers.deployer
      ).deploy("Forwarder", "ForwarderVersion");
      await expect(
        marketplace.connect(signers.admin).updateForwarder(newforwarder.address)
      )
        .to.emit(marketplace, "ForwarderUpdated")
        .withArgs(newforwarder.address);
    });
    it("update vault", async () => {
      const newvault = await ethers.Wallet.createRandom();
      await expect(
        marketplace.connect(signers.admin).updateVault(newvault.address)
      )
        .to.emit(marketplace, "VaultUpdated")
        .withArgs(newvault.address);
    });
    it("update payment method", async () => {
      const newPaymentMethod = await new contracts.PaymentMethods__factory(
        signers.deployer
      ).deploy(
        signers.admin.address,
        signers.oracle.address,
        [tokens.MOKA.address],
        [ethers.utils.parseUnits("100", 18)],
        [18],
        [parseUnits(0.0, 18)],
        forwarder.address
      );
      await marketplace
        .connect(signers.admin)
        .updatePaymentMethods(newPaymentMethod.address);
      expect(await marketplace.paymentMethods()).to.equal(
        newPaymentMethod.address
      );
    });

    it("update comission", async () => {
      await marketplace.connect(signers.admin).updateCommission(100);
      expect(await marketplace.connect(signers.admin).commission()).to.equal(
        100
      );
    });

    describe("Rent", () => {
      let holder: SignerWithAddress;
      let renter: SignerWithAddress;
      let tokenId: number;
      let price: BigNumberish;
      let rentExpiresAt: number;
      const rentDuration = 60 * 5;
      before(async () => {
        holder = signers.holder2;
        renter = signers.thirdparty;
        price = ethers.utils.parseUnits("1", 18);
        await marketplace
          .connect(signers.admin)
          .updatePaymentMethods(paymentMethods.address);
        console.log({
          payment: await paymentMethods.paymentMethod(tokens.MOKA.address),
        });
        await tokens.MOKA.connect(signers.admin).transfer(
          holder.address,
          ethers.utils.parseUnits("45", 18)
        );
        await tokens.MOKA.connect(holder).approve(
          seller.address,
          ethers.utils.parseUnits("45", 18)
        );
        await tokens.MOKA.connect(signers.admin).transfer(
          renter.address,
          ethers.utils.parseUnits("45", 18)
        );
        await tokens.MOKA.connect(renter).approve(
          marketplace.address,
          ethers.utils.parseUnits("45", 18)
        );
        const buyTx = await seller
          .connect(holder)
          .buyAvailableLootbox(0, tokens.MOKA.address);
        const buyReceipt = await buyTx.wait(1);
        buyReceipt.logs.map((log) => {
          if (log.address === mokensNFT.address) {
            const event = mokensNFT.interface.parseLog(log);
            if (event.name === "Mint") {
              tokenId = event.args.tokenId;
            }
          }
        });
      });

      it("should create a rent offer", async () => {
        await expect(
          marketplace
            .connect(holder)
            .createRentOffer(tokenId, price, rentDuration)
        )
          .to.emit(marketplace, "NewRentOffer")
          .withArgs(holder.address, tokenId, price, rentDuration);
      });
      it("should rented by thirdparty", async () => {
        console.log({
          balance: ethers.utils.formatEther(
            await tokens.MOKA.balanceOf(renter.address)
          ),
          allowance: ethers.utils.formatEther(
            await tokens.MOKA.allowance(renter.address, marketplace.address)
          ),
          offer: await marketplace.getOffer(tokenId),
        });
        const tx = await marketplace
          .connect(renter)
          .takeOffer(tokenId, tokens.MOKA.address);
        const receipt = await tx.wait(1);
        let tested = false;
        await Promise.all(
          receipt.logs.map(async (log) => {
            if (log.address === mokensNFT.address) {
              const event = mokensNFT.interface.parseLog(log);
              if (event.name === "UpdateUser") {
                const block = await ethers.provider.getBlock(
                  receipt.blockNumber
                );
                expect(event.args.tokenId).eq(tokenId);
                expect(event.args.user).eq(renter.address);

                rentExpiresAt = block.timestamp + rentDuration;
                expect(event.args.expires).eq(rentExpiresAt);

                tested = true;
              }
            }
          })
        );
        expect(tested).eq(true);
      });
      it("should not be rentable during an active rent", async () => {
        await tokens.MOKA.connect(signers.holder1).approve(
          marketplace.address,
          parseUnits(45, 18)
        );
        await expect(
          marketplace
            .connect(signers.holder1)
            .takeOffer(tokenId, tokens.MOKA.address)
        ).revertedWith("Rented");
      });
      it("should back to be rentable after current rent expires", async () => {
        await hre.timeAndMine.setTimeNextBlock(rentExpiresAt + 1);
        await hre.timeAndMine.mine();
        await marketplace
          .connect(signers.holder1)
          .takeOffer(tokenId, tokens.MOKA.address);
        expect(await mokensNFT.userOf(tokenId)).eq(signers.holder1.address);
      });
    });
  });
});
