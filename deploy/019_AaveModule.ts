import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const AaveAddressHolder = await deployments.get('AaveAddressHolder');
  const UniswapAddressHolder = await deployments.get('UniswapAddressHolder');
  const registry = await deployments.get('Registry');

  await deploy('AaveModule', {
    from: deployer,
    args: [AaveAddressHolder.address, UniswapAddressHolder.address, registry.address],
    log: true,
    autoMine: true,
  });
};

export default func;
func.tags = ['Module'];
func.dependencies = ['UniswapAddressHolder', 'AaveAddressHolder', 'Registry'];
