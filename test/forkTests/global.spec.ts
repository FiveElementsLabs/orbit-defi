import { ethers } from 'hardhat';
import { deployOrbit, getMainnetContracts } from '../shared/fixtures';

describe('Global Tests', function () {
  let governance: any = ethers.getSigners().then(async (signers) => {
    return signers[0];
  });
  let user: any = ethers.getSigners().then(async (signers) => {
    return signers[1];
  });
  let keeper: any = ethers.getSigners().then(async (signers) => {
    return signers[2];
  });
  let contracts: any;
  let orbit: any;

  before(async function () {
    governance = await governance;
    user = await user;
    keeper = await keeper;

    contracts = await getMainnetContracts();
    orbit = await deployOrbit(governance, keeper, contracts);
  });
});
