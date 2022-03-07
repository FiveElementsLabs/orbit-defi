import { expect } from 'chai';
import '@nomiclabs/hardhat-ethers';
import { ethers, waffle } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

// `describe` is a Mocha function that allows you to organize your tests. It's
// not actually needed, but having your tests organized makes debugging them
// easier. All Mocha functions are available in the global scope.

// `describe` receives the name of a section of your test suite, and a callback.
// The callback must define the tests of that section. This callback can't be
// an async function.

describe('Position manager contract', function () {
  // Mocha has four functions that let you hook into the the test runner's
  // lifecyle. These are: `before`, `beforeEach`, `after`, `afterEach`.

  // They're very useful to setup the environment for tests, and to clean it
  // up after they run.

  // A common pattern is to declare some variables, and assign them in the
  // `before` and `beforeEach` callbacks.
  // @ts-ignore
  let PositionManagerInstance;
  let owner: SignerWithAddress;

  // `beforeEach` will run before each test, re-deploying the contract every
  // time. It receives a callback, which can be async.
  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    [owner] = await ethers.getSigners();
    const PositionManager = await ethers.getContractFactory('PositionManager');
    PositionManagerInstance = await PositionManager.deploy(owner.address);
    await PositionManagerInstance.deployed();
  });

  describe('Deploy correctly', function () {
    it('Should correcly initialize constructor', async function () {
      // @ts-ignore
      expect(await PositionManagerInstance.owner()).to.equal(owner.address);
    });
  });
});
