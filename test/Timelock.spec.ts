import '@nomiclabs/hardhat-ethers';
const hre = require('hardhat');
const { getContractAddress } = require('@ethersproject/address');
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { AbiCoder } from 'ethers/lib/utils';
import { RegistryFixture, TimelockFixture } from './shared/fixtures';
import { Registry, Timelock } from '../typechain';

describe('Timelock.sol', function () {
  let deployer: any;
  let deployer2: any;
  let deployer3: any;
  let user: any;
  let registry: Registry;
  let timelock: Timelock;
  let abiCoder: AbiCoder;
  const contractAddr1 = '0x00000000219ab540356cBB839Cbe05303d7705Fa';
  const contractAddr2 = '0x29D7d1dd5B6f9C864d9db560D72a247c178aE86B';

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    const signers = await ethers.getSigners();
    deployer = signers[0];
    deployer2 = signers[1];
    deployer3 = signers[2];
    user = signers[3];

    //select standard abicoder
    abiCoder = ethers.utils.defaultAbiCoder;

    //deploy the registry - we need it to test the timelock features
    registry = await RegistryFixture().then((registryFix) => registryFix.registryFixture);

    // deploy the timelock
    const delay = 21600;
    timelock = (await TimelockFixture(deployer.address, delay)).timelockFixture;
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

  //   function setDelay(uint256 _delay) public {
  //     require(msg.sender == address(this), 'Timelock::setDelay: Call must come from Timelock.');
  //     require(_delay >= MINIMUM_DELAY, 'Timelock::setDelay: Delay must exceed minimum delay.');
  //     require(_delay <= MAXIMUM_DELAY, 'Timelock::setDelay: Delay must not exceed maximum delay.');
  //     delay = _delay;

  //     emit NewDelay(delay);
  // }

  describe('Admin settings ', function () {
    it('Should correctly set a new time delay', async function () {
      const newDelay = 40000;
      await timelock.connect(deployer).setDelay(newDelay);
      expect(await timelock.delay()).to.equal(newDelay);
    });
  });

  describe('Transaction processing', async function () {
    it('Should correctly queue a transaction', async function () {
      const target = registry.address;
      const value = 0;
      const signature = 'addNewContract(address)';
      const data = abiCoder.encode(['address'], [contractAddr2]);
      const eta = await ethers.provider.getBlock('latest').then((block) => block.timestamp + 51600);

      const txReceipt = await (await timelock.queueTransaction(target, value, signature, data, eta)).wait();

      const events = txReceipt.events!;
      expect(events[0].event).to.be.equal('QueueTransaction');
    });

    it('Should correctly cancel a queued transaction', async function () {
      const target = registry.address;
      const value = 0;
      const signature = 'addNewContract(address)';
      const data = abiCoder.encode(['address'], [contractAddr2]);
      const eta = (await ethers.provider.getBlock('latest')).timestamp + 51600;

      const txReceipt = await (await timelock.cancelTransaction(target, value, signature, data, eta)).wait();

      const events = txReceipt.events!;
      expect(events[0].event).to.be.equal('CancelTransaction');
    });
  });
});
