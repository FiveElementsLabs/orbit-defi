import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import hre, { ethers } from 'hardhat';
import { Config } from './000_Config';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const registry = await ethers.getContract('Registry');
  const diamondCutFacet = await deployments.get('DiamondCutFacet');
  const uniAddressHolder = await deployments.get('UniswapAddressHolder');
  const aaveAddressHolder = await deployments.get('AaveAddressHolder');

  await deploy('PositionManagerFactory', {
    from: deployer,
    args: [deployer, registry.address, diamondCutFacet.address, uniAddressHolder.address, aaveAddressHolder.address],
    log: true,
    autoMine: true,
  });

  await new Promise((resolve) => setTimeout(resolve, Config.sleep));

  const PositionManagerFactory = await ethers.getContract('PositionManagerFactory');

  await registry.addNewContract(
    hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('PositionManagerFactory')),
    PositionManagerFactory.address
  );
  await new Promise((resolve) => setTimeout(resolve, Config.sleep));

  await registry.setPositionManagerFactory(PositionManagerFactory.address);

  await new Promise((resolve) => setTimeout(resolve, Config.sleep));
};

export default func;

func.tags = ['PositionManagerFactory'];
