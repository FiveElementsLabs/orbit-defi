import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { Config } from './000_Config';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy('AaveModule', {
    from: deployer,
    args: [Config.aaveAddressHolder, Config.uniswapAddressHolder, Config.registry],
    log: true,
    autoMine: true,
  });
};

export default func;
func.tags = ['Module'];
