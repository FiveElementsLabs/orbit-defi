import { ethers } from 'hardhat';

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_MUMBAI);
  const signer = new ethers.Wallet(process.env.TEST_PRIVATE_KEY || '', provider);

  const PositionManagerFactory = await ethers.getContractAt(
    'PositionManagerFactory',
    '0x69465fE66FB8E2cE2ddc7d0d5E657Fb2141DF013',
    signer
  );

  await PositionManagerFactory.create({ gasLimit: 1000000 });

  await new Promise((resolve) => setTimeout(resolve, 10000));

  console.log(await PositionManagerFactory.getAllPositionManagers());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
