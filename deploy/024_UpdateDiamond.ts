import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { Config } from './000_Config';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy('UpdateDiamond', {
    from: deployer,
    args: [Config.keeper],
    log: true,
    autoMine: true,
  });
};

export default func;
func.tags = ['Recipe'];
