import { ethers } from 'hardhat';
import { getSelectors } from '../test/shared/fixtures';
import { Config } from '../deploy/000_Config';
import { Timelock, Registry, PositionManagerFactory, PositionManager } from '../typechain';

const printWarning = (network: string) => {
  console.warn('\nWARNING WARNING WARNING WARNING WARNING WARNING WARNING WARNING WARNING WARNING');
  console.log('WARNING\t\t\t\t\t\t\t\t\tWARNING');
  console.log('WARNING\t\tUsing private keys defined in hardhat.ethers.ts\t\tWARNING');
  console.log(`WARNING\t\tCurrently running on network: "${network}"\t\t\tWARNING`);
  console.log('WARNING\t\t\t\t\t\t\t\t\tWARNING');
  console.warn('WARNING WARNING WARNING WARNING WARNING WARNING WARNING WARNING WARNING WARNING\n');
};

async function main() {
  const network = process.env.HARDHAT_NETWORK;

  if (!network) throw new Error("Couldn't find a Hardhat network. Please specify --network flag");

  printWarning(network);

  const registryAddress = require(`../deployments/${network}/Registry.json`)?.address;
  const timelockAddress = require(`../deployments/${network}/Timelock.json`)?.address;
  const pmfAddress = require(`../deployments/${network}/PositionManagerFactory.json`)?.address;

  if (!pmfAddress || !registryAddress || !timelockAddress)
    throw new Error("Couldn't find some addresses, check deployments");

  // You have to specify a PositionManager address manually, as we don't deploy them
  const pmAddress = '0x46200F1a5bF2312302ff4d47a38F8EE33C72bd6A';

  const PM = (await ethers.getContractAt('PositionManager', pmAddress)) as PositionManager;
  const Registry = (await ethers.getContractAt('Registry', registryAddress)) as Registry;
  const Timelock = (await ethers.getContractAt('Timelock', timelockAddress)) as Timelock;
  const PMF = (await ethers.getContractAt('PositionManagerFactory', pmfAddress)) as PositionManagerFactory;

  const runAtEndOfFIle = async () => {
    // await deployContract();
    // await updateAlreadyDeployedModule();
    // await updateModuleOnPositionManager();
    // await updateAlreadyDeployedAction();
    // await logAllActions();
    // await logModuleInfo();
    // await logModuleInfoForSpecificPosition();
    // await changeAllGovernances();
    // await createPositionManagerForOwner();
    // await logAllPositionManagers();
    // await whitelistNewKeeper();
    // await addContractToRegistry();
    // await setNewPendingAdminOnTimelock();
    // await confirmNewAdminOnTimelock();
  };

  const deployContract = async () => {
    const _name = 'AutoCompoundModule';
    const _args = ['0xC661870dffDF3847481FF97015e2502aeFe04B35', '0xE41ebE287e5AbCb8598929e78AE6aD59B74a1631'];

    const factory = await ethers.getContractFactory(_name);
    const contract = await factory.deploy(..._args);
    await contract.deployed();
    console.log(`${_name} deployed at ${contract?.address}`);
  };

  const updateAlreadyDeployedModule = async () => {
    const _moduleName = 'WithdrawRecipes';
    const _moduleAddress = '0x16dFCD94b9238925729cCdA3C25e56290c7C54AA';

    const moduleKeccak = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(_moduleName));
    await (await Registry.changeContract(moduleKeccak, _moduleAddress, { gasLimit: Config.gasLimit }))?.wait();
    console.log(`${_moduleName} updated to ${_moduleAddress}`);
  };

  const updateModuleOnPositionManager = async () => {
    const _moduleAddress = '0x16dFCD94b9238925729cCdA3C25e56290c7C54AA';
    const _ownerPrivateKey = '';
    const _ownerAddress = '';
    const _moduleData = 200;
    const _tokenId = 180007;

    const moduleData = ethers.utils.hexZeroPad(ethers.utils.hexlify(_moduleData), 32);
    const owner = new ethers.Wallet(
      _ownerPrivateKey,
      new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_POLYGON)
    );
    const pm = await PMF.userToPositionManager(_ownerAddress);
    const PM = await ethers.getContractAt('PositionManager', pm);
    await (await PM.connect(owner).toggleModule(_tokenId, _moduleAddress, true, { gasLimit: Config.gasLimit }))?.wait();
    await (
      await PM.connect(owner).setModuleData(_tokenId, _moduleAddress, moduleData, { gasLimit: Config.gasLimit })
    )?.wait();
  };

  const updateAlreadyDeployedAction = async () => {
    const _actionAddress = '0x8b4Ce8F550782aA718b23Ea6B7A60E1038eE69e4';
    const _actionName = 'AaveWithdraw';
    const _action = 2; // 0: add, 1: update, 2: remove

    const actionContract = await ethers.getContractAt(_actionName, _actionAddress);
    const facet = {
      facetAddress: _actionAddress,
      action: _action,
      functionSelectors: await getSelectors(actionContract),
    };

    // Update action data with facet
    await (await PMF.updateActionData(facet, { gasLimit: Config.gasLimit })).wait();

    // Update the action for all existing PMs
    // note: consider adding nonce manually
    for (const pm of await PMF.getAllPositionManagers()) {
      await (await PMF.updateDiamond(pm, [facet], { gasLimit: Config.gasLimit })).wait();
      console.log(`updated ${_actionName} for pm: `, pm);
    }
  };

  const logAllActions = async () => {
    for (let i = 0; true; i++) console.log(await PMF.actions(i));
  };

  const logModuleInfo = async () => {
    const _moduleName = 'WithdrawRecipes';

    const moduleKeccak = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(_moduleName));
    const moduleInfo = await Registry.getModuleInfo(moduleKeccak);
    console.log(`Registry.moduleInfo(${_moduleName}): `, moduleInfo);
  };

  const logModuleInfoForSpecificPosition = async () => {
    const _tokenId = 180007;
    const _moduleAddress = '0x16dFCD94b9238925729cCdA3C25e56290c7C54AA';

    console.log(await PM.getModuleInfo(_tokenId, _moduleAddress));
  };

  const changeAllGovernances = async () => {
    const _newGovernance = '0xA0A41b8800179b633e71edDC241F64C91a09E6ea';

    await (await PMF.changeGovernance(_newGovernance, { gasLimit: Config.gasLimit })).wait();
    console.log(':: Changed PositionManagerFactory governance');
    await (await Registry.changeGovernance(_newGovernance, { gasLimit: Config.gasLimit })).wait();
    console.log(':: Changed Registry governance');
  };

  const createPositionManagerForOwner = async () => {
    const _ownerPrivateKey = '';
    const _ownerAddress = '';

    const owner = new ethers.Wallet(
      _ownerPrivateKey,
      new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_POLYGON)
    );
    await (await PMF.connect(owner).create({ gasLimit: Config.gasLimit })).wait();
    const pm = await PMF.userToPositionManager(_ownerAddress);
    console.log(`:: Created new PositionManager for ${_ownerAddress} at ${pm}`);
  };

  const logAllPositionManagers = async () => {
    await PMF.getAllPositionManagers().then(console.log);
  };

  const whitelistNewKeeper = async () => {
    const _newKeeper = '';

    await (await Registry.addKeeperToWhitelist(_newKeeper, { gasLimit: Config.gasLimit })).wait();
    console.log(`:: Added ${_newKeeper} to keeper whitelist`);
  };

  const addContractToRegistry = async () => {
    const _contractName = 'AutoCompundModuleClone';
    const _contractAddress = '0xC812607BB6ddC9E8c7e0B6E00C9ad909b4C0964A';
    const _defaultValue = 2;
    const _activeByDefault = false;

    const moduleId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(_contractName));
    const defaultValue = ethers.utils.hexZeroPad(ethers.utils.hexlify(_defaultValue), 32);

    await (
      await Registry.addNewContract(moduleId, _contractAddress, defaultValue, _activeByDefault, {
        gasLimit: Config.gasLimit,
      })
    ).wait();

    console.log(`:: Added ${_contractName} to registry`);
  };

  const setNewPendingAdminOnTimelock = async () => {
    const _newPendingAdmin = '0xA0A41b8800179b633e71edDC241F64C91a09E6ea';

    await (await Timelock.setNewPendingAdmin(_newPendingAdmin, { gasLimit: Config.gasLimit })).wait();
    console.log(`:: Set new pending admin to ${_newPendingAdmin}`);
  };

  const confirmNewAdminOnTimelock = async () => {
    await (await Timelock.confirmNewAdmin({ gasLimit: Config.gasLimit })).wait();
    console.log(`:: Confirmed new admin of Timelock`);
  };

  await runAtEndOfFIle();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
