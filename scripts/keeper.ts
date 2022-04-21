import hre from 'hardhat';

import { ethers } from 'hardhat';
import { PositionManager } from '../typechain';
import PositionManagerjson from '../artifacts/contracts/PositionManager.sol/PositionManager.json';

import { keeperSetup } from './keeper_setup';

async function main() {
  // This is needed to run the script from _node_ instad of _npx hardhat_:
  // await hre.run('compile');

  const debug = process.env.DEBUG || true;

  // Run Setup script.
  // This will be replaced by a helper function to get the contracts
  // with getContractAt(contract, abi)
  const { PositionManagerFactory, IdleLiquidityModule, NonFungiblePositionManager, AutoCompound } = await keeperSetup();

  const rebalanceAllPositions = async () => {
    if (debug) console.log(`Running Rebalance task \n`);

    const allPositionManagers = await PositionManagerFactory.getAllPositionManagers();
    for (const positionManagerAddress of allPositionManagers) {
      if (debug) console.log(`Position Manager: ${positionManagerAddress}`);

      const positionManagerContract = (await ethers.getContractAt(
        PositionManagerjson['abi'],
        positionManagerAddress
      )) as PositionManager;

      const positionIds = await positionManagerContract.getAllUniPositions();

      for (const positionId of positionIds) {
        if (debug) console.log(`-- Rebalancing position ID: ${positionId}`);

        await positionManagerContract.updateUncollectedFees(positionId);
        await IdleLiquidityModule.rebalance(positionId, positionManagerAddress);
      }
    }
  };

  const autocompoundAllPositions = async () => {
    if (debug) console.log(`Running Autocompound task \n`);

    const allPositionManagers = await PositionManagerFactory.getAllPositionManagers();
    for (const positionManagerAddress of allPositionManagers) {
      if (debug) console.log(`Position Manager: ${positionManagerAddress}`);

      const positionManagerContract = (await ethers.getContractAt(
        PositionManagerjson['abi'],
        positionManagerAddress
      )) as PositionManager;

      const positionIds = await positionManagerContract.getAllUniPositions();

      for (const positionId of positionIds) {
        if (debug) console.log(`-- Autocompounding position ID: ${positionId}`);

        await AutoCompound.autoCompoundFees(positionManagerAddress);
      }
    }
  };

  // In the real keeper script, these functions will be handled
  // by a cron-job running periodically (e.g. behind pm2 on an AWS instance)
  await autocompoundAllPositions();
  await rebalanceAllPositions();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
