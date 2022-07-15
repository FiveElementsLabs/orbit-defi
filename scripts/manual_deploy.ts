import { ethers } from 'hardhat';
import { getSelectors } from '../test/shared/fixtures';
import { Config } from '../deploy/000_Config';

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_POLYGON);
  const signer = new ethers.Wallet(process.env.TEST_PRIVATE_KEY || '', provider);

  const PMF = await ethers.getContractAt('PositionManagerFactory', '0x6c15ee0B11661Fa5F0a2639E7D80ed72Cc53771d');
  // new: 0xED240EaC9100F2E09C1a9b99a466C8eaaE15035f
  // const AaveWithdraw = await ethers.getContractAt('AaveWithdraw', '0xED240EaC9100F2E09C1a9b99a466C8eaaE15035f');
  // const facet = {
  //   facetAddress: '0xED240EaC9100F2E09C1a9b99a466C8eaaE15035f',
  //   action: 0,
  //   functionSelectors: await getSelectors(AaveWithdraw),
  // };

  const Registry = await ethers.getContractAt('Registry', '0xb2016935c0C75d040c9B9De7EA7671905e84CcCF');
  const AaveModuleKeccak = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('AaveModule'));

  console.log(await Registry.getModuleInfo(AaveModuleKeccak));

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
