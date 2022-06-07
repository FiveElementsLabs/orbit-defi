import { ethers } from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  const Registry = await ethers.getContract('Registry');

  await deploy('UniswapAddressHolder', {
    from: deployer,
    args: [
      '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', //nonfungiblePositionManager address
      '0x1F98431c8aD98523631AE4a59f267346ea31F984', //uniswapv3Factory address
      '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', //swapRouter address,
      Registry.address,
    ],
    log: true,
  });
};

export default func;
func.tags = ['AddressHolder'];
func.dependencies = ['Registry'];
