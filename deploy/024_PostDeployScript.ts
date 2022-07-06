import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { Config, START_TIME } from './000_Config';

const PostDeployScript: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // 1. whitelist modules and recipes
  // 2. set timelock as registry governance
  // 3. eventually change governance from deployer (on Factory etc.)

  const { getNamedAccounts } = hre;
  const { multiSig } = await getNamedAccounts();

  const Registry = await ethers.getContract('Registry');

  //get Modules Contracts
  const AutoCompoundModule = await ethers.getContract('AutoCompoundModule');
  const IdleLiquidityModule = await ethers.getContract('IdleLiquidityModule');
  const AaveModule = await ethers.getContract('AaveModule');

  // For future reference:
  // Remember to use `ethers.utils.hexZeroPad(ethers.utils.hexlify(1), 32)`
  // to send padded bytes values to the registry on addNewContract calls.

  // AutoCompound defaults: active with 2% threshold
  const autoCompoundIsActiveByDefault = true;
  const autoCompoundThreshold = ethers.utils.hexZeroPad(ethers.utils.hexlify(200), 32);
  await Registry.addNewContract(
    hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('AutoCompoundModule')),
    AutoCompoundModule.address,
    autoCompoundThreshold,
    autoCompoundIsActiveByDefault,
    {
      gasPrice: Config.gasPrice,
      gasLimit: Config.gasLimit,
    }
  );
  await new Promise((resolve) => setTimeout(resolve, Config.sleep));
  console.log(':: Added AutoCompoundModule to Registry');

  // IdleLiquidity defaults: active with 2% threshold
  const idleLiquidityIsActiveByDefault = true;
  const idleLiquidityThreshold = ethers.utils.hexZeroPad(ethers.utils.hexlify(200), 32);
  await Registry.addNewContract(
    hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('IdleLiquidityModule')),
    IdleLiquidityModule.address,
    idleLiquidityThreshold,
    idleLiquidityIsActiveByDefault,
    {
      gasPrice: Config.gasPrice,
      gasLimit: Config.gasLimit,
    }
  );
  await new Promise((resolve) => setTimeout(resolve, Config.sleep));
  console.log(':: Added IdleLiquidityModule to Registry');

  // Aave defaults: inactive with 5% threshold
  const aaveIsActiveByDefault = false;
  const aaveThreshold = ethers.utils.hexZeroPad(ethers.utils.hexlify(500), 32);
  await Registry.addNewContract(
    hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('AaveModule')),
    AaveModule.address,
    aaveThreshold,
    aaveIsActiveByDefault,
    {
      gasPrice: Config.gasPrice,
      gasLimit: Config.gasLimit,
    }
  );
  await new Promise((resolve) => setTimeout(resolve, Config.sleep));
  console.log(':: Added AaveModule to Registry');

  // Get recipes
  const DepositRecipes = await ethers.getContract('DepositRecipes');
  const WithdrawRecipes = await ethers.getContract('WithdrawRecipes');

  await Registry.addNewContract(
    hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('DepositRecipes')),
    DepositRecipes.address,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(0), 32),
    true,
    {
      gasPrice: Config.gasPrice,
      gasLimit: Config.gasLimit,
    }
  );
  await new Promise((resolve) => setTimeout(resolve, Config.sleep));
  console.log(':: Added DepositRecipes to Registry');

  await Registry.addNewContract(
    hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('WithdrawRecipes')),
    WithdrawRecipes.address,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(0), 32),
    true,
    {
      gasPrice: Config.gasPrice,
      gasLimit: Config.gasLimit,
    }
  );
  await new Promise((resolve) => setTimeout(resolve, Config.sleep));
  console.log(':: Added WithdrawRecipes to Registry');

  // Set Timelock as Registry owner
  const Timelock = await ethers.getContract('Timelock');
  await Registry.changeGovernance(Timelock.address, {
    gasPrice: Config.gasPrice,
    gasLimit: Config.gasLimit,
  });
  await new Promise((resolve) => setTimeout(resolve, Config.sleep));
  console.log(':: Changed Registry governance to Timelock');

  // Set factory owner (has rights to push actions)
  const PositionManagerFactory = await ethers.getContract('PositionManagerFactory');
  await PositionManagerFactory.changeGovernance(multiSig, {
    gasPrice: Config.gasPrice,
    gasLimit: Config.gasLimit,
  });
  console.log(':: Changed PositionManagerFactory governance to multiSig');

  const END_TIME = Date.now();
  console.log(`:: Deployment took ${(END_TIME - START_TIME) / 1000}s`);
};

export default PostDeployScript;
PostDeployScript.tags = ['PostDeploy'];
