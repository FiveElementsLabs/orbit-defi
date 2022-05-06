import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';

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

  await Registry.addNewContract(
    hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('AutoCompoundModule')),
    AutoCompoundModule.address
  );
  await new Promise((resolve) => setTimeout(resolve, 30000));
  console.log(':: Added AutoCompoundModule to Registry');

  await Registry.addNewContract(
    hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('IdleLiquidityModule')),
    IdleLiquidityModule.address
  );
  await new Promise((resolve) => setTimeout(resolve, 30000));
  console.log(':: Added IdleLiquidityModule to Registry');

  await Registry.addNewContract(
    hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('AaveModule')),
    AaveModule.address
  );
  await new Promise((resolve) => setTimeout(resolve, 30000));
  console.log(':: Added AaveModule to Registry');

  // Get recipes
  const DepositRecipes = await ethers.getContract('DepositRecipes');
  const WithdrawRecipes = await ethers.getContract('WithdrawRecipes');

  await Registry.addNewContract(
    hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('DepositRecipes')),
    DepositRecipes.address
  );
  await new Promise((resolve) => setTimeout(resolve, 30000));
  console.log(':: Added DepositRecipes to Registry');

  await Registry.addNewContract(
    hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('WithdrawRecipes')),
    WithdrawRecipes.address
  );
  await new Promise((resolve) => setTimeout(resolve, 30000));
  console.log(':: Added WithdrawRecipes to Registry');

  // Set Timelock as Registry owner
  const Timelock = await ethers.getContract('Timelock');
  await Registry.changeGovernance(Timelock.address);
  await new Promise((resolve) => setTimeout(resolve, 30000));
  console.log(':: Changed Registry governance to Timelock');

  // Set factory owner (has rights to push actions)
  const PositionManagerFactory = await ethers.getContract('PositionManagerFactory');
  await PositionManagerFactory.changeGovernance(multiSig);
  console.log(':: Changed PositionManagerFactory governance to multiSig');
};

export default PostDeployScript;
PostDeployScript.tags = ['PostDeploy'];
