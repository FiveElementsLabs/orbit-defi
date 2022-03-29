import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { Contract } from 'ethers';
const hre = require('hardhat');
import { ethers } from 'hardhat';
const { getContractAddress } = require('@ethersproject/address');
import { RegistryFixture } from './shared/fixtures';

import { Registry } from '../typechain';

describe('Registry.sol', function () {
  let deployer: any;
  let user: any;
  let registry: Registry;
  const contractAddr1 = '0x00000000219ab540356cBB839Cbe05303d7705Fa';
  const id1 = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes(contractAddr1));

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    const signers = await ethers.getSigners();
    deployer = signers[0];
    user = signers[1];

    //deploy the registry
    registry = await RegistryFixture().then((registryFix) => registryFix.registryFixture);
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
