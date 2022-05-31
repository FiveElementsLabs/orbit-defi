import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { Contract } from 'ethers';
import hre, { ethers } from 'hardhat';
import { RegistryFixture } from '../shared/fixtures';
import { AbiCoder } from 'ethers/lib/utils';

describe('Registry.sol', function () {
  let deployer: any;
  let user: any;
  let Registry: Contract;
  let IdleLiquidityModule: Contract;
  let AutoCompoundModule: Contract;
  let abiCoder: AbiCoder;

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
      '0x0000000000000000000000000000000000000001', //we don't need this contract for this test
      Registry.address
    )) as Contract;
    await IdleLiquidityModule.deployed();

    const AutoCompoundModuleFactory = await ethers.getContractFactory('AutoCompoundModule');
    AutoCompoundModule = (await AutoCompoundModuleFactory.deploy(
      '0x0000000000000000000000000000000000000001',
      //we don't need this contract for this test
      Registry.address
    )) as Contract;
    await AutoCompoundModule.deployed();

    abiCoder = ethers.utils.defaultAbiCoder;
  });

  describe('Registry.sol - deployment ', function () {
    it('Should assign governance at constructor', async function () {
      expect(await Registry.governance()).to.be.equal(deployer.address);
    });
  });

  describe('Registry.sol - addNewContract() ', function () {
    it('Should add and activate new contract', async function () {
      const idIdle = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('IdleLiquidityModule'));
      await Registry.connect(deployer).addNewContract(
        idIdle,
        IdleLiquidityModule.address,
        hre.ethers.utils.formatBytes32String('1'),
        true
      );
      const moduleInfo = await Registry.getModuleInfo(idIdle);

      expect(moduleInfo[1]).to.be.equal(true);
    });

    it('Should fail if it is not called by owner', async function () {
      try {
        const fakeId = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('ThisIsATest'));

        await Registry.connect(user).addNewContract(
          fakeId,
          user.address,
          hre.ethers.utils.formatBytes32String('1'),
          true
        );
      } catch (err: any) {
        expect(err.toString()).to.have.string('Registry::onlyGovernance: Call must come from governance.');
      }
    });
    it('Should set default activation', async function () {
      const id = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Module'));
      await Registry.connect(deployer).addNewContract(
        id,
        user.address,
        hre.ethers.utils.formatBytes32String('1'),
        true
      );
      const moduleInfo = await Registry.getModuleInfo(id);

      expect(moduleInfo[3]).to.be.equal(true);
      const newId = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Module2'));
      await Registry.connect(deployer).addNewContract(
        newId,
        deployer.address,
        hre.ethers.utils.formatBytes32String('1'),
        false
      );
      const anotherModuleInfo = await Registry.getModuleInfo(newId);

      expect(anotherModuleInfo[3]).to.be.equal(false);
    });

    it('Should set default value for module', async function () {
      const id = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Module3'));
      await Registry.connect(deployer).addNewContract(
        id,
        user.address,
        hre.ethers.utils.formatBytes32String('1'),
        true
      );
      const moduleInfo = await Registry.getModuleInfo(id);
      expect(moduleInfo[2]).to.be.equal(hre.ethers.utils.formatBytes32String('1'));
    });

    it('Should not set default value for module', async function () {
      const id = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Module4'));
      await Registry.connect(deployer).addNewContract(
        id,
        user.address,
        hre.ethers.utils.formatBytes32String('0'),
        true
      );
      const moduleInfo = await Registry.getModuleInfo(id);
      expect(moduleInfo[2]).to.be.equal(hre.ethers.utils.formatBytes32String('0'));
    });

    describe('Registry.sol - switchModuleState() ', function () {
      it('Should be able to deactivate a contract', async function () {
        const idAutoCompound = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('AutoCompoundModule'));
        await Registry.connect(deployer).addNewContract(
          idAutoCompound,
          AutoCompoundModule.address,
          abiCoder.encode(['uint256'], [69]),
          true
        );

        await Registry.connect(deployer).switchModuleState(idAutoCompound, false);

        const moduleInfo = await Registry.getModuleInfo(idAutoCompound);

        expect(moduleInfo[1]).to.equal(false);
      });
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
