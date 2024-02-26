import { ethers } from "hardhat";
import * as contracts from "../typechain";
import readline from "readline";

async function main(priceUpdater: string, forwarderAddress: string) {
  const {
    PRIVATE_KEY,
    ADMIN_ACCOUNT,
    PAYMENT_METHODS_TOKENS,
    PAYMENT_METHODS_PRICES,
    PAYMENT_METHODS_DECIMALS,
    PAYMENT_METHODS_DISCOUNTS,
  } = process.env;
  if (
    !PRIVATE_KEY ||
    !ADMIN_ACCOUNT ||
    !PAYMENT_METHODS_TOKENS ||
    !PAYMENT_METHODS_PRICES ||
    !PAYMENT_METHODS_DECIMALS ||
    !PAYMENT_METHODS_DISCOUNTS
  )
    return;

  const deployer = new ethers.Wallet(PRIVATE_KEY, ethers.provider);

  console.log("deployer", deployer.address);

  const paymentMethodTokenAddress = PAYMENT_METHODS_TOKENS.split(",");
  const paymentMethodPrice = PAYMENT_METHODS_PRICES.split(",").map((price) => {
    return ethers.utils.parseUnits(price, 18);
  });

  const paymentMethodDecimals = PAYMENT_METHODS_DECIMALS.split(",");
  const paymentMethodDiscount = PAYMENT_METHODS_DISCOUNTS.split(",").map(
    (discount) => {
      return ethers.utils.parseUnits(discount, 18);
    }
  );

  const paymentMethods = await new contracts.PaymentMethods__factory(
    deployer
  ).deploy(
    ADMIN_ACCOUNT,
    priceUpdater,
    paymentMethodTokenAddress,
    paymentMethodPrice,
    paymentMethodDecimals,
    paymentMethodDiscount,
    forwarderAddress
  );

  console.log("Payment Method Contract", paymentMethods.address);
}

const rd = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
rd.question(`Oracle/Price Updater address? `, (priceUpdater: string) => {
  rd.question(`Forwarder address? `, (forwarderAddress: string) => {
    rd.close();
    main(priceUpdater, forwarderAddress)
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  });
});
