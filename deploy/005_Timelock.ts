import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy('Timelock', {
    from: deployer,
    args: [deployer, 21600],
    log: true,
    autoMine: true,
  });
};

export default func;
func.tags = ['Timelock'];
