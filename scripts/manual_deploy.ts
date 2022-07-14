import { ethers } from 'hardhat';
import { getSelectors } from '../test/shared/fixtures';
import { Config } from '../deploy/000_Config';

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_POLYGON);
  const signer = new ethers.Wallet(process.env.TEST_PRIVATE_KEY || '', provider);

  const PMF = await ethers.getContractAt('PositionManagerFactory', '0x6c15ee0B11661Fa5F0a2639E7D80ed72Cc53771d');
  // new: 0xED240EaC9100F2E09C1a9b99a466C8eaaE15035f
  const AaveWithdraw = await ethers.getContractAt('AaveWithdraw', '0x8b4Ce8F550782aA718b23Ea6B7A60E1038eE69e4');
  const facet = {
    facetAddress: '0x8b4Ce8F550782aA718b23Ea6B7A60E1038eE69e4',
    action: 2,
    functionSelectors: await getSelectors(AaveWithdraw),
  };

  // for (let i = 0; i < 20; i++) {
  //   const action = await PMF.actions(i);
  //   console.log(action);
  // }

  // await PMF.updateActionData(facet);

  // const WithdrawRecipesFactory = await ethers.getContractFactory('WithdrawRecipes');
  // const withdrawRecipes = await WithdrawRecipesFactory.deploy(
  //   '0x6c15ee0B11661Fa5F0a2639E7D80ed72Cc53771d',
  //   '0x18dE1cC847C23EAb8B5232a5153CEe9236163825'
  // );
  // await withdrawRecipes.deployed();
  // console.log('WithdrawRecipes deployed at', withdrawRecipes.address);

  // const Registry = await ethers.getContractAt('Registry', '0xb2016935c0C75d040c9B9De7EA7671905e84CcCF');
  // const WithdrawRecipesKeccak = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('WithdrawRecipes'));
  // console.log(await Registry.getModuleInfo(WithdrawRecipesKeccak));
  // await Registry.changeContract(WithdrawRecipesKeccak, '0x18eB13d5535404CbBA34Cfc89eba0dD7560c0A08');

  // const pms = await PMF.getAllPositionManagers();
  // for (const pm of pms) {
  //   await PMF.updateDiamond(pm, [facet], { gasLimit: 3e6 });
  //   console.log('done: pm: ', pm);
  // }

  // await PMF.updateActionData(facet, { gasLimit: 3e6 });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
