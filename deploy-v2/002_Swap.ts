import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { getSelectors } from '../test/shared/fixtures';
import { Config } from './000_Config';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy('Swap', {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });
  const Swap = await ethers.getContract('Swap');

  const PositionManagerFactory = await ethers.getContractAt('PositionManagerFactory', Config.positionManagerFactory);

  // add actions to diamond cut
  await PositionManagerFactory.updateActionData(
    { facetAddress: Swap.address, action: 0, functionSelectors: await getSelectors(Swap) },
    {
      gasPrice: Config.gasPrice,
      gasLimit: Config.gasLimit,
    }
  );
  await new Promise((resolve) => setTimeout(resolve, Config.sleep));
};

export default func;
func.tags = ['Action'];
