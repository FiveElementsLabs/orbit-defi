import { ethers } from 'hardhat';

async function main() {
  try {
    const provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_POLYGON || '');
    const signer = new ethers.Wallet(process.env.POLYGON_PRIVATE_KEY || '', provider);

    const PositionManagerFactory = await ethers.getContractAt(
      'PositionManagerFactory',
      '0x31196Fbda9111a345e133EE1C247C94EDb6A7a7A',
      signer
    );

    await PositionManagerFactory.create({ gasLimit: 1000000 });
    console.log('PositionManager created. Now getting all PM addresses...');

    await new Promise((resolve) => setTimeout(resolve, 10000));

    console.log('All PM addresses: ', await PositionManagerFactory.getAllPositionManagers());
  } catch (error: any) {
    throw new Error(error?.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
