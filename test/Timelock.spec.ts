import '@nomiclabs/hardhat-ethers';
const hre = require('hardhat');
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { AbiCoder } from 'ethers/lib/utils';
import { RegistryFixture, TimelockFixture } from './shared/fixtures';
import { Registry, Timelock } from '../typechain';

describe('Timelock.sol', function () {
  let deployer: any;
  let deployer2: any;
  let deployer3: any;
  let deployer4: any;
  let registry: Registry;
  let timelock: Timelock;
  let timelock2: Timelock;
  let abiCoder: AbiCoder;
  const randomContractAddress = '0x29D7d1dd5B6f9C864d9db560D72a247c178aE86B';

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    const signers = await ethers.getSigners();
    deployer = signers[0];
    deployer2 = signers[1];
    deployer3 = signers[2];
    deployer4 = signers[3];

    //select standard abicoder
    abiCoder = ethers.utils.defaultAbiCoder;

    // deploy the timelock
    const delay = 21600; // 6 hours
    timelock = (await TimelockFixture(deployer.address, delay)).timelockFixture;

    // deploy an additional timelock to test admin features
    timelock2 = (await TimelockFixture(deployer4.address, delay)).timelockFixture;

    //deploy the registry - we need it to test the timelock features
    registry = (await RegistryFixture(timelock.address)).registryFixture;
  });

  describe('Deployment ', function () {
    it('Should correctly set timelock admin', async function () {
      expect(await timelock.admin()).to.equal(deployer.address);
    });

    it('Should revert if the delay is too small', async function () {
      const delayTooSmall = 100;
      const timelockFactory = await ethers.getContractFactory('Timelock');
      await expect(timelockFactory.deploy(deployer2.address, delayTooSmall)).to.be.revertedWith(
        'Timelock::constructor: Delay must exceed minimum delay.'
      );
    });

    it('Should revert if the delay is too big', async function () {
      const delayTooSmall = 3e7;
      const timelockFactory = await ethers.getContractFactory('Timelock');
      await expect(timelockFactory.deploy(deployer3.address, delayTooSmall)).to.be.revertedWith(
        'Timelock::constructor: Delay must not exceed maximum delay.'
      );
    });
  });

  describe('Admin settings ', function () {
    it('Should correctly set a new time delay', async function () {
      const newDelay = 40000;
      await timelock2.connect(deployer4).setDelay(newDelay);
      expect(await timelock2.delay()).to.equal(newDelay);
    });

    it('Should correctly set a new pending admin', async function () {
      const newPendingAdmin = deployer2.address;
      await timelock2.connect(deployer4).setPendingAdmin(newPendingAdmin);
      expect(await timelock2.pendingAdmin()).to.equal(newPendingAdmin);
    });

    it('Should correctly accept a new admin', async function () {
      await timelock2.connect(deployer2).acceptAdmin();
      expect(await timelock2.admin()).to.equal(deployer2.address);
    });
  });

  describe('Transaction processing', async function () {
    it('Should correctly queue a transaction', async function () {
      const target = registry.address;
      const value = 0;
      const signature = 'addNewContract(address)';
      const data = abiCoder.encode(['address'], [randomContractAddress]);
      const eta = (await ethers.provider.getBlock('latest')).timestamp + 21700;

      const txReceipt = await (
        await timelock.connect(deployer).queueTransaction(target, value, signature, data, eta)
      ).wait();

      const events = txReceipt.events!;
      expect(events[0].event).to.be.equal('QueueTransaction');
    });

    it('Should correctly cancel a queued transaction', async function () {
      const target = registry.address;
      const value = 0;
      const signature = 'addNewContract(address)';
      const data = abiCoder.encode(['address'], [randomContractAddress]);
      const eta = (await ethers.provider.getBlock('latest')).timestamp + 21700;

      const txReceipt = await (
        await timelock.connect(deployer).cancelTransaction(target, value, signature, data, eta)
      ).wait();

      const events = txReceipt.events!;
      expect(events[0].event).to.be.equal('CancelTransaction');
    });

    it('Should correctly execute a queued transaction', async function () {
      const target = registry.address;
      const value = 0;
      const signature = 'addNewContract(address)';
      const data = abiCoder.encode(['address'], [randomContractAddress]);
      const eta = (await ethers.provider.getBlock('latest')).timestamp + 21700;

      const queueTxReceipt = await (
        await timelock.connect(deployer).queueTransaction(target, value, signature, data, eta)
      ).wait();

      const queueEvents = queueTxReceipt.events!;
      expect(queueEvents[0].event).to.be.equal('QueueTransaction');

      // Increase timestamp to satisfy timelock delay
      // We must increase it by at least eta amount (21700 in this case)
      const forwardInTime = 30000;
      await ethers.provider.send('evm_increaseTime', [forwardInTime]);

      const executeTxReceipt = await (
        await timelock.connect(deployer).executeTransaction(target, value, signature, data, eta)
      ).wait();

      const executeEvents = executeTxReceipt.events!;
      expect(executeEvents[0].event).to.be.equal('ExecuteTransaction');
    });

    it('Should revert if not enough time has passed', async function () {
      const target = registry.address;
      const value = 0;
      const signature = 'addNewContract(address)';
      const data = abiCoder.encode(['address'], [randomContractAddress]);
      const eta = (await ethers.provider.getBlock('latest')).timestamp + 21700;

      const queueTxReceipt = await (
        await timelock.connect(deployer).queueTransaction(target, value, signature, data, eta)
      ).wait();

      const queueEvents = queueTxReceipt.events!;
      expect(queueEvents[0].event).to.be.equal('QueueTransaction');

      // Increase timestamp not enough to satisfy timelock delay
      const forwardInTime = 1000;
      await ethers.provider.send('evm_increaseTime', [forwardInTime]);

      expect(timelock.connect(deployer).executeTransaction(target, value, signature, data, eta)).to.be.revertedWith(
        "Timelock::executeTransaction: Transaction hasn't surpassed time lock."
      );
    });
  });
});
