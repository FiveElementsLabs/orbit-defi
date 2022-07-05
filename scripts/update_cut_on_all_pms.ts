import { Contract } from 'ethers';
import { ethers } from 'hardhat';
import { Config } from '../deploy/000_Config';
import { getSelectors } from '../test/shared/fixtures';
import { AaveWithdraw } from '../typechain';

async function main() {
  try {
    const provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_POLYGON || '');
    const signer = new ethers.Wallet(process.env.POLYGON_PRIVATE_KEY || '', provider);

    const PositionManagerFactory = await ethers.getContractAt(
      'PositionManagerFactory',
      Config.positionManagerFactory,
      signer
    );

      const managers = await PositionManagerFactory.getAllPositionManagers();
      
      const actions = [{
          facetAddress: AaveWithdraw.address,
          action: 0, //(0: add, 1: replace, 2: remove)
          functionSelectors: getSelectors(AaveWithdraw)
      }, {
          facetAddress: Swap.address,
          action: 0, //(0: add, 1: replace, 2: remove)
          functionSelectors: getSelectors(Swap)
      },{
          facetAddress: SwapToPositionRatio.address,
          action: 0, //(0: add, 1: replace, 2: remove)
          functionSelectors: getSelectors(SwapToPositionRatio)
      },{
          facetAddress: ZapIn.address,
          action: 0, //(0: add, 1: replace, 2: remove)
          functionSelectors: getSelectors(ZapIn)
      },{
          facetAddress: ZapOut.address,
          action: 0, //(0: add, 1: replace, 2: remove)
          functionSelectors: getSelectors(ZapOut)
          }];
      
    let positionManager: Contract;
      for (const manager of managers) {
        positionManager = await ethers.getContractAt('PositionManager', manager, signer);
          await positionManager.diamondCut(actions, "0x0000000000000000000000000000000000000000",0);
      }
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
