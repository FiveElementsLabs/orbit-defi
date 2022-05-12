import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { Contract } from 'ethers';
import hre from 'hardhat';
import { ethers } from 'hardhat';
import { RegistryFixture } from '../shared/fixtures';

describe('Registry.sol', function () {
  let deployer: any;
  let user: any;
  let Registry: Contract;
  let IdleLiquidityModule: Contract;
  let AutoCompoundModule: Contract;

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    const signers = await ethers.getSigners();
    deployer = signers[0];
    user = signers[1];

    const zeroAddress = ethers.constants.AddressZero;

    //deploy the registry
    Registry = (await RegistryFixture(deployer.address)).registryFixture;

    //Deploy modules
    const IdleLiquidityModuleFactory = await ethers.getContractFactory('IdleLiquidityModule');
    IdleLiquidityModule = (await IdleLiquidityModuleFactory.deploy(
      zeroAddress, //we don't need this contract for this test
      Registry.address
    )) as Contract;
    await IdleLiquidityModule.deployed();

    const AutoCompoundModuleFactory = await ethers.getContractFactory('AutoCompoundModule');
    AutoCompoundModule = (await AutoCompoundModuleFactory.deploy(
      zeroAddress, //we don't need this contract for this test
      Registry.address
    )) as Contract;
    await AutoCompoundModule.deployed();
  });

  describe('Registry.sol - deployment ', function () {
    it('Should assign governance at constructor', async function () {
      expect(await Registry.governance()).to.be.equal(deployer.address);
    });
  });

  describe('Registry.sol - addNewContract() ', function () {
    it('Should add and activate new contract', async function () {
      const idIdle = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('IdleLiquidityModule'));
      await Registry.connect(deployer).addNewContract(idIdle, IdleLiquidityModule.address);

      expect(await Registry.isActive(idIdle)).to.be.equal(true);
    });

    it('Should fail if it is not called by owner', async function () {
      try {
        const fakeId = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('ThisIsATest'));

        await Registry.connect(user).addNewContract(fakeId, user.address);
      } catch (err: any) {
        expect(err.toString()).to.have.string('Registry::onlyGovernance: Call must come from governance.');
      }
    });
  });

  describe('Registry.sol - switchModuleState() ', function () {
    it('Should be able to disactivate a contract', async function () {
      const idAutoCompound = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('AutoCompoundModule'));
      await Registry.connect(deployer).addNewContract(idAutoCompound, AutoCompoundModule.address);

      await Registry.connect(deployer).switchModuleState(idAutoCompound, false);

      expect(await Registry.isActive(idAutoCompound)).to.equal(false);
    });
  });

  describe('Registry.sol - changeModule()', function () {
    it('Should be able to change address for a contract', async function () {
      const idIdle = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('IdleLiquidityModule'));
      await Registry.changeContract(idIdle, user.address);
      expect((await Registry.modules(idIdle)).contractAddress).to.equal(user.address);
    });
  });

  describe('Registry.sol - keeperWhitelist', function () {
    it('Should be able to add a keeper', async function () {
      await Registry.addKeeperToWhitelist(user.address);
      expect(await Registry.isWhitelistedKeeper(user.address)).to.be.true;
    });
  });
});
