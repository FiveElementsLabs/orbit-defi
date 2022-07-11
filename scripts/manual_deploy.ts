import { ethers } from 'hardhat';
import { getSelectors } from '../test/shared/fixtures';
import { Config } from '../deploy/000_Config';

async function main() {
  try {
    const provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_POLYGON || '');
    const signer = new ethers.Wallet(process.env.TEST_PRIVATE_KEY || '', provider);

    const PositionManagerFactory = await ethers.getContractAt(
      'PositionManagerFactory',
      '0xca73f6C7412096eEA9dE37E2F3f6fBA1E5B883a4',
      signer
    );

    /* await new Promise((resolve) => setTimeout(resolve, 10000));

    const SwapToPositionRatioFactory = await ethers.getContractFactory('SwapToPositionRatio');
    const SwapToPositionRatio = await SwapToPositionRatioFactory.deploy();
    await SwapToPositionRatio.deployed();
    console.log('SwaptoPositionRatio: ', SwapToPositionRatio.address);
    await new Promise((resolve) => setTimeout(resolve, 20000));

   

    const IdleLiquidityModuleFactory = await ethers.getContractFactory('IdleLiquidityModule');
    const IdleLiquidityModule = await IdleLiquidityModuleFactory.deploy(
      '0xB2bF52c9d6A5464B2C94c5f6E3d24a3E009bAd07',
      '0xa896b6Be8ac9287d3bF6d71d336514DD0db4b037'
    );
    await IdleLiquidityModule.deployed();

    console.log('IdleLiquidityModule: ', IdleLiquidityModule.address); */
    const SwapToRatio = await ethers.getContractAt('SwapToPositionRatio', '0x48Cd937FC61fafd5bfD742650cC72C9Fd96ac107');

    await PositionManagerFactory.pushActionData(SwapToRatio.address, await getSelectors(SwapToRatio), {
      gasPrice: Config.gasPrice,
      gasLimit: Config.gasLimit,
    });

    // UniswapAddressHolder.address, registry.address

    await new Promise((resolve) => setTimeout(resolve, 20000));
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
