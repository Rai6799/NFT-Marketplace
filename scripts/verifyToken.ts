const hre = require("hardhat");

async function main() {
    await hre.run("verify", {
        address: '0xe8d3c9bb08a583725a3c8dca534e20660f2a5cda',
        constructorArgs: [
            '0x756f1F3708832F39cf59b41f3563eda6ab5F8F6f',
            'Mokens League',
            'MOKA',
            '500000000000000000000000000',
            ['0x756f1F3708832F39cf59b41f3563eda6ab5F8F6f'],
            '0xa6102ddF9C0Ee8d2854F60Fa0c133035d068460B',
            '0xB4E7AafBa85A2C9754Db5bAa17395222623eAcc2'
        ]
      })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });