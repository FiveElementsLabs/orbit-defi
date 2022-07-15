import { ethers } from 'hardhat';
import { getSelectors } from '../test/shared/fixtures';
import { Config } from '../deploy/000_Config';

// WARNING WARNING WARNING WARNING WARNING WARNING WARNING WARNING WARNING WARNING
//
// Functions in this script can modify the
// live deployments if called with the wrong flags.
// Remember to use the --network polygonTest flag for testing
//
// WARNING WARNING WARNING WARNING WARNING WARNING WARNING WARNING WARNING WARNING

async function main() {
  console.log('**** Warning: using private keys defined in hardhat.ethers.ts ****');
  console.log('**** Remember use this script along with the --network polygonTest flag for testing ****');

  const PMF = await ethers.getContractAt('PositionManagerFactory', '0x6c15ee0B11661Fa5F0a2639E7D80ed72Cc53771d');
  const PM = await ethers.getContractAt('PositionManager', '0x46200F1a5bF2312302ff4d47a38F8EE33C72bd6A');
  const Registry = await ethers.getContractAt('Registry', '0xb2016935c0C75d040c9B9De7EA7671905e84CcCF');

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
  };

  const deployContract = async () => {
    const _name = 'AaveModule';
    const _args = ['0xED240EaC9100F2E09C1a9b99a466C8eaaE15035f'];

    const factory = await ethers.getContractFactory(_name);
    const contract = await factory.deploy(..._args);
    await contract.deployed();
    console.log(`${name} deployed at ${contract.address}`);
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
    await PM.connect(owner).toggleModule(_tokenId, _moduleAddress, true, { gasLimit: Config.gasLimit });
    await PM.connect(owner).setModuleData(_tokenId, _moduleAddress, moduleData, { gasLimit: Config.gasLimit });
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
    await PMF.updateActionData(facet, { gasLimit: Config.gasLimit });

    // Update the action for all existing PMs
    for (const pm of await PMF.getAllPositionManagers()) {
      await PMF.updateDiamond(pm, [facet], { gasLimit: Config.gasLimit });
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
    const _newGovernance = '0xF4d83F3207788Ee14446EEC94b9b0E3548409777';

    await PMF.changeGovernance(_newGovernance, { gasLimit: Config.gasLimit });
    console.log(':: Changed PositionManagerFactory governance');
    await Registry.changeGovernance(_newGovernance, { gasLimit: Config.gasLimit });
    console.log(':: Changed Registry governance');
  };

  const createPositionManagerForOwner = async () => {
    const _ownerPrivateKey = '';
    const _ownerAddress = '';

    const owner = new ethers.Wallet(
      _ownerPrivateKey,
      new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_POLYGON)
    );
    await PMF.connect(owner).create({ gasLimit: Config.gasLimit });
    const pm = await PMF.userToPositionManager(_ownerAddress);
    console.log(`:: Created new PositionManager for ${_ownerAddress} at ${pm}`);
  };

  await runAtEndOfFIle();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
