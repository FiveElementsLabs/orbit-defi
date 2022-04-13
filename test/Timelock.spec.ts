import '@nomiclabs/hardhat-ethers';
const hre = require('hardhat');
const { getContractAddress } = require('@ethersproject/address');
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { RegistryFixture, TimelockFixture } from './shared/fixtures';
import { Registry, Timelock } from '../typechain';

describe('Timelock.sol', function () {
  let deployer: any;
  let user: any;
  let registry: Registry;
  let timelock: Timelock;
  const contractAddr1 = '0x00000000219ab540356cBB839Cbe05303d7705Fa';

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    const signers = await ethers.getSigners();
    deployer = signers[0];
    user = signers[1];

    //deploy the registry
    registry = await RegistryFixture().then((registryFix) => registryFix.registryFixture);

    // deploy the timelock
    const delay = 21600;
    timelock = (await TimelockFixture(deployer.address, delay)).timelockFixture;
  });

  describe('Deployment ', function () {
    it('Should assign owner at constructor', async function () {
      expect(await registry.owner()).to.be.equal(deployer.address);
    });
  });
  describe('Modules update ', function () {
    it('Should add and activate new contract', async function () {
      const tx = await registry.connect(deployer).addNewContract(contractAddr1);
      const entry = await registry.entries(contractAddr1);
      const activated = entry['activated'];
      expect(activated).to.be.equal(true);
    });

    it('Should fail if it is not called by owner', async function () {
      try {
        await registry.connect(user).addNewContract(contractAddr1);
      } catch (err: any) {
        expect(err.toString()).to.have.string('Only owner');
      }
    });
  });
});
