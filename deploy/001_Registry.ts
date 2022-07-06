import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const maxTwapDeviation = 300;
  const twapDuration = 3;

  await deploy('Registry', {
    from: deployer,
    args: [deployer, maxTwapDeviation, twapDuration],
    log: true,
    autoMine: true,
  });
};

export default func;
