import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { getSelectors } from '../test/shared/fixtures';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy('UpdateUncollectedFees', {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });
  const UpdateUncollectedFees = await ethers.getContract('UpdateUncollectedFees');

  const PositionManagerFactory = await ethers.getContract('PositionManagerFactory');

  // add actions to diamond cut
  await PositionManagerFactory.pushActionData(UpdateUncollectedFees.address, await getSelectors(UpdateUncollectedFees));
  await new Promise((resolve) => setTimeout(resolve, 30000));
};

export default func;
func.tags = ['Action'];
func.dependencies = ['PositionManagerFactory'];
