import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { Config, START_TIME } from './000_Config';

const PostDeployScript: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // 1. whitelist modules and recipes
  // 2. set timelock as registry governance
  // 3. eventually change governance from deployer (on Factory etc.)

  const AbiCoder = ethers.utils.defaultAbiCoder;

  const Registry = await ethers.getContractAt('Registry', Config.registry);
  const Timelock = await ethers.getContractAt('Timelock', Config.timelock);

  //get Modules Contracts
  const AutoCompoundModule = await ethers.getContract('AutoCompoundModule');
  const IdleLiquidityModule = await ethers.getContract('IdleLiquidityModule');
  const AaveModule = await ethers.getContract('AaveModule');

  // For future reference:
  // Remember to use `ethers.utils.hexZeroPad(ethers.utils.hexlify(1), 32)`
  // to send padded bytes values to the registry on addNewContract calls.

  const signature = 'changeContract(bytes32,address)';

  // AutoCompound defaults: active with 2% threshold
  let contractIdKeccak = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('AutoCompoundModule'));
  const target = Registry.address;
  const msgValue = 0;
  let data = AbiCoder.encode(['bytes32', 'address'], [contractIdKeccak, AutoCompoundModule.address]);
  let eta = Math.floor(Date.now() / 1000) + 21750;

  console.log(`ETA: ${new Date(eta * 1000)}`);
  console.log('ETA TIMESTAMP: KEEP THIS TO EXECUTE CALL: ', eta);

  let tx = await (
    await Timelock.queueTransaction(target, msgValue, signature, data, eta, {
      gasPrice: Config.gasPrice,
      gasLimit: Config.gasLimit,
    })
  ).wait();

  console.log(`Transaction queued: ${tx?.hash}`);
  await new Promise((resolve) => setTimeout(resolve, Config.sleep));
  console.log(':: Added AutoCompoundModule to Registry');

  // IdleLiquidity defaults: active with 2% threshold
  contractIdKeccak = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('IdleLiquidityModule'));
  data = AbiCoder.encode(['bytes32', 'address'], [contractIdKeccak, IdleLiquidityModule.address]);
  eta = Math.floor(Date.now() / 1000) + 21750;

  console.log(`ETA: ${new Date(eta * 1000)}`);
  console.log('ETA TIMESTAMP: KEEP THIS TO EXECUTE CALL: ', eta);

  tx = await (
    await Timelock.queueTransaction(target, msgValue, signature, data, eta, {
      gasPrice: Config.gasPrice,
      gasLimit: Config.gasLimit,
    })
  ).wait();

  console.log(`Transaction queued: ${tx?.hash}`);
  await new Promise((resolve) => setTimeout(resolve, Config.sleep));
  console.log(':: Added IdleLiquidityModule to Registry');

  // Aave defaults: inactive with 5% threshold
  contractIdKeccak = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('AaveModule'));
  data = AbiCoder.encode(['bytes32', 'address'], [contractIdKeccak, AaveModule.address]);
  eta = Math.floor(Date.now() / 1000) + 21750;

  console.log(`ETA: ${new Date(eta * 1000)}`);
  console.log('ETA TIMESTAMP: KEEP THIS TO EXECUTE CALL: ', eta);

  tx = await (
    await Timelock.queueTransaction(target, msgValue, signature, data, eta, {
      gasPrice: Config.gasPrice,
      gasLimit: Config.gasLimit,
    })
  ).wait();

  console.log(`Transaction queued: ${tx?.hash}`);
  await new Promise((resolve) => setTimeout(resolve, Config.sleep));
  console.log(':: Added AaveModule to Registry');

  // Get recipes
  const DepositRecipes = await ethers.getContract('DepositRecipes');
  const WithdrawRecipes = await ethers.getContract('WithdrawRecipes');

  contractIdKeccak = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('DepositRecipes'));
  data = AbiCoder.encode(['bytes32', 'address'], [contractIdKeccak, DepositRecipes.address]);
  eta = Math.floor(Date.now() / 1000) + 21750;

  console.log(`ETA: ${new Date(eta * 1000)}`);
  console.log('ETA TIMESTAMP: KEEP THIS TO EXECUTE CALL: ', eta);

  tx = await (
    await Timelock.queueTransaction(target, msgValue, signature, data, eta, {
      gasPrice: Config.gasPrice,
      gasLimit: Config.gasLimit,
    })
  ).wait();

  console.log(`Transaction queued: ${tx?.hash}`);
  await new Promise((resolve) => setTimeout(resolve, Config.sleep));
  console.log(':: Added DepositRecipes to Registry');

  contractIdKeccak = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('WithdrawRecipes'));
  data = AbiCoder.encode(['bytes32', 'address'], [contractIdKeccak, WithdrawRecipes.address]);
  eta = Math.floor(Date.now() / 1000) + 21750;

  console.log(`ETA: ${new Date(eta * 1000)}`);
  console.log('ETA TIMESTAMP: KEEP THIS TO EXECUTE CALL: ', eta);

  tx = await (
    await Timelock.queueTransaction(target, msgValue, signature, data, eta, {
      gasPrice: Config.gasPrice,
      gasLimit: Config.gasLimit,
    })
  ).wait();

  console.log(`Transaction queued: ${tx?.hash}`);
  await new Promise((resolve) => setTimeout(resolve, Config.sleep));
  console.log(':: Added WithdrawRecipes to Registry');

  const END_TIME = Date.now();
  console.log(`:: Deployment took ${(END_TIME - START_TIME) / 1000}s`);
};

export default PostDeployScript;
PostDeployScript.tags = ['PostDeploy'];
