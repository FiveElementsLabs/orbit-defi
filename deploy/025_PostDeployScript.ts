import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { Config, START_TIME } from './000_Config';

const PostDeployScript: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // 1. add modules, recipes and keepers on the registry
  // 2. set timelock as registry governance
  // 3. change governance from deployer on PM Factory

  const Registry = await ethers.getContract('Registry');

  // ******************** Add modules and recipes to registry ********************
  const AutoCompoundModule = await ethers.getContract('AutoCompoundModule');
  const IdleLiquidityModule = await ethers.getContract('IdleLiquidityModule');
  const AaveModule = await ethers.getContract('AaveModule');
  const DepositRecipes = await ethers.getContract('DepositRecipes');
  const WithdrawRecipes = await ethers.getContract('WithdrawRecipes');
  const UpdateDiamond = await ethers.getContract('UpdateDiamond');

  // Autocompound module:     ON  with 2% fee threshold         (data = 2)
  // IdleLiquidity module:    OFF with 2% distance from range   (data = 200)
  // Aave module:             ON  with 5% distance from range   (data = 500)

  const autoCompoundIsActiveByDefault = true;
  const idleLiquidityIsActiveByDefault = false;
  const aaveIsActiveByDefault = true;
  const autoCompoundThreshold = ethers.utils.hexZeroPad(ethers.utils.hexlify(2), 32);
  const idleLiquidityThreshold = ethers.utils.hexZeroPad(ethers.utils.hexlify(200), 32);
  const aaveThreshold = ethers.utils.hexZeroPad(ethers.utils.hexlify(500), 32);

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

  await Registry.addNewContract(
    hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('UpdateDiamond')),
    UpdateDiamond.address,
    ethers.utils.hexZeroPad(ethers.utils.hexlify(0), 32),
    true,
    {
      gasPrice: Config.gasPrice,
      gasLimit: Config.gasLimit,
    }
  );
  await new Promise((resolve) => setTimeout(resolve, Config.sleep));
  console.log(':: Added UpdateDiamond to Registry');

  // ****************** Add keeper(s) to the whitelist ******************
  const keeperAddress = '0xb86659C1010f60CC3fDE9EF90C9d3D71C537A526';
  await Registry.addKeeperToWhitelist(keeperAddress, { gasPrice: Config.gasPrice, gasLimit: Config.gasLimit });
  await new Promise((resolve) => setTimeout(resolve, Config.sleep));
  console.log(':: Added keeper to whitelist');

  // Set  Registry owner to Timelock
  // const Timelock = await ethers.getContract('Timelock');
  // await Registry.changeGovernance(Timelock.address, {
  //   gasPrice: Config.gasPrice,
  //   gasLimit: Config.gasLimit,
  // });
  // await new Promise((resolve) => setTimeout(resolve, Config.sleep));
  // console.log(':: Changed Registry governance to Timelock');

  // Set factory owner (has rights to push actions) to Multisig
  // const PositionManagerFactory = await ethers.getContract('PositionManagerFactory');
  // await PositionManagerFactory.changeGovernance(process.env.GOVERNANCE_ADDRESS, {
  //   gasPrice: Config.gasPrice,
  //   gasLimit: Config.gasLimit,
  // });
  // console.log(':: Changed PositionManagerFactory governance to multiSig');

  const END_TIME = Date.now();
  console.log(`:: Deployment took ${(END_TIME - START_TIME) / 1000}s`);
};

export default PostDeployScript;
PostDeployScript.tags = ['PostDeploy'];
