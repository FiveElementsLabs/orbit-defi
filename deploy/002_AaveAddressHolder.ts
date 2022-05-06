import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, getChainId } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const chainId = await getChainId();
  let lendingPoolAddress;

  if (chainId === '1' || chainId === '31337') lendingPoolAddress = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';
  if (chainId === '137' || chainId === '80001') lendingPoolAddress = '0x8dFf5E27EA6b7AC08EbFdf9eB090F32ee9a30fcf';

  await deploy('AaveAddressHolder', {
    from: deployer,
    args: [
      lendingPoolAddress, // Aave lendingPool
    ],
    log: true,
    autoMine: true,
  });
};

export default func;
func.tags = ['AddressHolder'];
