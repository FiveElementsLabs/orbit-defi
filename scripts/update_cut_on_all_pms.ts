import { ethers } from 'hardhat';
import { Config } from '../deploy/000_Config';
import { getSelectors } from '../test/shared/fixtures';

async function main() {
  //to be executed by a keeper (since only whitelisted can trigger fallback on positionManager)
  try {
    const provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_POLYGON || '');
    const signer = new ethers.Wallet(process.env.POLYGON_PRIVATE_KEY || '', provider);

    const PositionManagerFactory = await ethers.getContractAt(
      'PositionManagerFactory',
      Config.positionManagerFactory,
      signer
    );
    const AaveWithdraw = await ethers.getContractAt('AaveWithdraw', Config.aaveWithdraw, signer);
    const Swap = await ethers.getContractAt('Swap', Config.swap, signer);
    const SwapToPositionRatio = await ethers.getContractAt('SwapToPositionRatio', Config.swapToPositionRatio, signer);
    const ZapIn = await ethers.getContractAt('ZapIn', Config.zapIn, signer);
    const ZapOut = await ethers.getContractAt('ZapOut', Config.zapOut, signer);

    const managers = await PositionManagerFactory.getAllPositionManagers();

    const actions = [
      {
        facetAddress: AaveWithdraw.address,
        action: 0, //(0: add, 1: replace, 2: remove)
        functionSelectors: getSelectors(AaveWithdraw),
      },
      {
        facetAddress: Swap.address,
        action: 0, //(0: add, 1: replace, 2: remove)
        functionSelectors: getSelectors(Swap),
      },
      {
        facetAddress: SwapToPositionRatio.address,
        action: 0, //(0: add, 1: replace, 2: remove)
        functionSelectors: getSelectors(SwapToPositionRatio),
      },
      {
        facetAddress: ZapIn.address,
        action: 0, //(0: add, 1: replace, 2: remove)
        functionSelectors: getSelectors(ZapIn),
      },
      {
        facetAddress: ZapOut.address,
        action: 0, //(0: add, 1: replace, 2: remove)
        functionSelectors: getSelectors(ZapOut),
      },
    ];

    const updateDiamond = await ethers.getContractAt('UpdateDiamond', Config.updateDiamond, signer);
    for (const manager of managers) {
      await updateDiamond.updateDiamond(manager, actions);
    }
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
