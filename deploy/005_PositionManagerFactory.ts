import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { getSelectors } from '../test/shared/fixtures';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy('PositionManagerFactory', {
    from: deployer,
    args: [deployer],
    log: true,
    autoMine: true,
  });

  // export interface TxOptions extends CallOptions {
  //   from: string;
  //   log?: boolean; // TODO string (for comment in log)
  //   autoMine?: boolean;
  //   estimatedGasLimit?: string | number | BigNumber;
  //   estimateGasExtra?: string | number | BigNumber;
  //   waitConfirmations?: number;
  // }
};

export default func;
