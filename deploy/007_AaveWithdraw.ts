import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { getSelectors } from '../test/shared/fixtures';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy('AaveWithdraw', {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  const AaveWithdraw = await ethers.getContract('AaveWithdraw');

  const PositionManagerFactory = await ethers.getContract('PositionManagerFactory');

  // add actions to diamond cut
  await PositionManagerFactory.pushActionData(AaveWithdraw.address, await getSelectors(AaveWithdraw));
  await new Promise((resolve) => setTimeout(resolve, 30000));
};

export default func;
func.tags = ['Action'];
func.dependencies = ['PositionManagerFactory'];
