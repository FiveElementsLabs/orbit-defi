import { expect } from 'chai';
import '@nomiclabs/hardhat-ethers';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';
import { tokensFixture, poolFixture } from './shared/fixtures';

const PositionManagerContract = require('../artifacts/contracts/PositionManager.sol/PositionManager.json');

describe('Position manager contract', function () {
  let PositionManagerInstance: Contract;
  let PositionManagerFactoryInstance: Contract;

  let owner: any;
  let signers: any;
  let NonFungiblePositionManager: Contract;
  let token0: Contract, token1: Contract;
  let poolI: any;

  before(async function () {
    // Initializing pool states
    const { token0Fixture, token1Fixture } = await tokensFixture();
    token0 = token0Fixture;
    token1 = token1Fixture;
    const { pool, NonfungiblePositionManager } = await poolFixture(token0, token1);
    NonFungiblePositionManager = NonfungiblePositionManager;
    poolI = pool;
    signers = await ethers.getSigners();
    const user = signers[0];
    await token0.mint(user.address, ethers.utils.parseEther('1000000000000'));
    await token1.mint(user.address, ethers.utils.parseEther('1000000000000'));
    let startTick = -240000;
    const price = Math.pow(1.0001, startTick);
    await pool.initialize('0x' + (Math.sqrt(price) * Math.pow(2, 96)).toString(16));
    await pool.increaseObservationCardinalityNext(100);
    await token0
      .connect(signers[0])
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('1000000000000'));

    await token1.approve(
      NonFungiblePositionManager.address,
      ethers.utils.parseEther('1000000000000'),
      {
        from: signers[0].address,
      },
    );
  });

  describe('PositionManagerFactory - create', function () {
    it('Should create a new position manager instance', async function () {
      const PositionManagerFactory = await ethers.getContractFactory('PositionManagerFactory');

      PositionManagerFactoryInstance = await PositionManagerFactory.deploy();
      await PositionManagerFactoryInstance.deployed();

      [owner] = await ethers.getSigners();

      await PositionManagerFactoryInstance.create(
        owner.address,
        NonFungiblePositionManager.address,
        poolI.address,
      );

      const deployedContract = await PositionManagerFactoryInstance.positionManagers(0);
      const PositionManagerInstance = await ethers.getContractAt(
        PositionManagerContract.abi,
        deployedContract,
      );

      expect(PositionManagerInstance).to.exist;
    });
  });
});
