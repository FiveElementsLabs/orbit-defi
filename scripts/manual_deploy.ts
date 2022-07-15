import { ethers } from 'hardhat';
import { getSelectors } from '../test/shared/fixtures';
import { Config } from '../deploy/000_Config';

async function main() {
  console.log('**** Warning: using private key defined in hardhat.ethers.ts ****');
  console.log('**** Please use this script along with the --network polygonTest flag ****');

  const PMF = await ethers.getContractAt('PositionManagerFactory', '0x6c15ee0B11661Fa5F0a2639E7D80ed72Cc53771d');
  const PM = await ethers.getContractAt('PositionManager', '0x46200F1a5bF2312302ff4d47a38F8EE33C72bd6A');
  const Registry = await ethers.getContractAt('Registry', '0xb2016935c0C75d040c9B9De7EA7671905e84CcCF');

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
    await Registry.changeContract(moduleKeccak, _moduleAddress);
    console.log(`${_moduleName} updated to ${_moduleAddress}`);
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

    // Update the action for all existing pms
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

  const changeAllGovernances = async () => {
    const _newGovernance = '0xF4d83F3207788Ee14446EEC94b9b0E3548409777';

    await PMF.changeGovernance(_newGovernance);
    console.log(':: Changed PositionManagerFactory governance');
    await Registry.changeGovernance(_newGovernance);
    console.log(':: Changed Registry governance');
  };

  const logModuleInfoForSpecificPosition = async () => {
    const _tokenId = 180007;
    const _moduleAddress = '0x16dFCD94b9238925729cCdA3C25e56290c7C54AA';

    console.log(await PM.getModuleInfo(_tokenId, _moduleAddress));
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
