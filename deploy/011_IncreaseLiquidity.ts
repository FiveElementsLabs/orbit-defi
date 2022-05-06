import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { getSelectors } from '../test/shared/fixtures';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy('IncreaseLiquidity', {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });
  const IncreaseLiquidity = await ethers.getContract('IncreaseLiquidity');

  const PositionManagerFactory = await ethers.getContract('PositionManagerFactory');

  // add actions to diamond cut
  await PositionManagerFactory.pushActionData(IncreaseLiquidity.address, await getSelectors(IncreaseLiquidity));
};

export default func;
func.tags = ['Action'];
func.dependencies = ['PositionManagerFactory'];
