import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { Contract } from 'ethers';
const hre = require('hardhat');
import { ethers } from 'hardhat';
import { RegistryFixture } from './shared/fixtures';

describe('Registry.sol', function () {
  let deployer: any;
  let user: any;
  let registry: Contract;
  let IdleLiquidityModule: Contract;
  let autoCompoundModule: Contract;

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    const signers = await ethers.getSigners();
    deployer = signers[0];
    user = signers[1];

    //deploy the registry
    registry = (await RegistryFixture()).registryFixture;

    const zeroAddress = ethers.constants.AddressZero;

    //Deploy modules
    const idleLiquidityModuleFactory = await ethers.getContractFactory('IdleLiquidityModule');
    IdleLiquidityModule = (await idleLiquidityModuleFactory.deploy(
      zeroAddress //we don't need this contract for this test
    )) as Contract;
    await IdleLiquidityModule.deployed();

    const autoCompoundModuleFactory = await ethers.getContractFactory('AutoCompoundModule');
    autoCompoundModule = (await autoCompoundModuleFactory.deploy(
      zeroAddress, //we don't need this contract for this test
      30
    )) as Contract;
    await autoCompoundModule.deployed();
  });

  describe('Deployment ', function () {
    it('Should assign governance at constructor', async function () {
      expect(await registry.governance()).to.be.equal(deployer.address);
    });
  });
  describe('Modules update ', function () {
    it('Should add and activate new contract', async function () {
      const idIdle = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('IdleLiquidityModule'));
      await registry.connect(deployer).addNewContract(idIdle, IdleLiquidityModule.address);

      expect(await registry.isActive(idIdle)).to.be.equal(true);
    });

    it('Should be able to disactivate a contract', async function () {
      const idAutoCompound = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('AutoCompoundModule'));
      await registry.connect(deployer).addNewContract(idAutoCompound, autoCompoundModule.address);

      await registry.connect(deployer).toggleModule(idAutoCompound, false);

      expect(await registry.isActive(idAutoCompound)).to.equal(false);
    });

    it('Should be able to change address for a contract', async function () {
      const idIdle = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('IdleLiquidityModule'));
      await registry.changeContract(idIdle, user.address);
      expect((await registry.modules(idIdle)).contractAddress).to.equal(user.address);
    });

    it('Should fail if it is not called by owner', async function () {
      try {
        const fakeId = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('ThisIsATest'));

        await registry.connect(user).addNewContract(fakeId, user.address);
      } catch (err: any) {
        expect(err.toString()).to.have.string('Only governance function');
      }
    });
  });
});
