import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { getSelectors } from '../test/shared/fixtures';
import { Config } from './000_Config';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy('ZapIn', {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  const zapInAction = await ethers.getContract('ZapIn');
  const PositionManagerFactory = await ethers.getContractAt('PositionManagerFactory', Config.positionManagerFactory);

  // add actions to diamond cut
  await PositionManagerFactory.updateActionData(
    { facetAddress: zapInAction.address, action: 0, functionSelectors: await getSelectors(zapInAction) },
    {
      gasPrice: Config.gasPrice,
      gasLimit: Config.gasLimit,
    }
  );
  await new Promise((resolve) => setTimeout(resolve, Config.sleep));
};

export default func;
func.tags = ['Action'];
