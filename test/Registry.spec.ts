import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { Contract } from 'ethers';
const hre = require('hardhat');
import { ethers } from 'hardhat';

describe('Registry.sol', function () {
  let deployer: any;
  let user: any;
  let registry: Contract;
  const contractAddr1 = '0x00000000219ab540356cBB839Cbe05303d7705Fa';
  const id1 = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes(contractAddr1));

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    const signers = await ethers.getSigners();
    deployer = signers[0];
    user = signers[1];

    //deploy the registry
    registry = await ethers
      .getContractFactory('Registry')
      .then((contract) => contract.deploy().then((deploy) => deploy.deployed()));
  });

  describe('Deployment ', function () {
    it('Should assign owner at constructor', async function () {
      expect(await registry.owner()).to.be.equal(deployer.address);
    });
  });
  describe('Modules update ', function () {
    it('Should add new contract', async function () {
      // For the sake of test let's use deployer address
      const tx = await registry.connect(deployer).addNewContract(id1, contractAddr1);
      const address = await registry.getAddr(id1);
      expect(address).to.be.equal(contractAddr1);
    });

    it('Should fail if it is not called by owner', async function () {
      try {
        await registry.connect(user).addNewContract(id1, contractAddr1);
      } catch (err: any) {
        expect(err.toString()).to.have.string('Only owner');
      }
    });
  });
});
