import { expect } from 'chai';
import '@nomiclabs/hardhat-ethers';
import { NonfungiblePositionManager, PositionManager, IUniswapV3Pool, TestRouter } from '../typechain';
import { BigNumber, Contract, Wallet } from 'ethers';
import { ethers, waffle } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { tokensFixture, poolFixture, routerFixture } from './shared/fixtures';
import { sign } from 'crypto';
import { time } from 'console';
import internal from 'assert';

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
  let PositionManagerInstance: Contract;
  let owner: any;
  let user: SignerWithAddress;
  let signers: any;
  let NonFungiblePositionManager: Contract;
  let token0: Contract, token1: Contract;
  let poolI: any;
  let pool: any;
  let router: Contract;
  let LPtokenId: any;

  before(async function () {
    // Initializing pool states
    const { token0Fixture, token1Fixture } = await tokensFixture();
    token0 = token0Fixture;
    token1 = token1Fixture;
    const { pool, NonfungiblePositionManager } = await poolFixture(token0, token1);
    NonFungiblePositionManager = NonfungiblePositionManager;
    signers = await ethers.getSigners();
    const user = signers[0];
    await token0.mint(user.address, ethers.utils.parseEther('1000000000000'));
    await token1.mint(user.address, ethers.utils.parseEther('1000000000000'));
    let startTick = -240000;
    const price = Math.pow(1.0001, startTick);
    await pool.initialize('0x' + (Math.sqrt(price) * Math.pow(2, 96)).toString(16));
    await pool.increaseObservationCardinalityNext(100);
    const { sqrtPriceX96, tick } = await pool.slot0();
    await token0
      .connect(signers[0])
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('1000000000000'));

    await token1.approve(NonFungiblePositionManager.address, ethers.utils.parseEther('1000000000000'), {
      from: signers[0].address,
    });

    poolI = pool;

    const res = await token1.allowance(NonFungiblePositionManager.address, signers[0].address);

    // Pool has some liquidity
    const liquidityProvider = await signers[1];
    await token0
      .connect(liquidityProvider)
      .mint(liquidityProvider.address, ethers.utils.parseEther('10000000000000000000000000000'));
    await token1
      .connect(liquidityProvider)
      .mint(liquidityProvider.address, ethers.utils.parseEther('10000000000000000000000000000'));
    await token0
      .connect(liquidityProvider)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('10000000000000000000000000000'));

    await token1
      .connect(liquidityProvider)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('10000000000000000000000000000'), {
        from: liquidityProvider.address,
      });

    let tx = await NonFungiblePositionManager.connect(liquidityProvider).mint(
      [
        token0.address,
        token1.address,
        3000,
        -240000 - 60 * 1000,
        -240000 + 60 * 1000,
        '0x' + (1e30).toString(16),
        '0x' + (1e30).toString(16),
        0,
        0,
        liquidityProvider.address,
        Date.now() + 1000,
      ],

      { gasLimit: 670000 }
    );

    const receipt = await tx.wait();
    const data = receipt.events[receipt.events.length - 1].args;
    LPtokenId = data.tokenId;

    // Trader has some tokens
    const trader = await signers[2];
    await token0.connect(trader).mint(trader.address, ethers.utils.parseEther('1000000000000'));
    await token1.connect(trader).mint(trader.address, ethers.utils.parseEther('1000000000000'));
    router = await routerFixture();
    await token0.connect(trader).approve(router.address, ethers.utils.parseEther('1000000000000'));
    await token1.connect(trader).approve(router.address, ethers.utils.parseEther('1000000000000'));
    await token0.connect(trader).approve(pool.address, ethers.utils.parseEther('1000000000000'));
    await token1.connect(trader).approve(pool.address, ethers.utils.parseEther('1000000000000'));
  });

  // `beforeEach` will run before each test, re-deploying the contract every
  // time. It receives a callback, which can be async.
  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    [owner] = await ethers.getSigners();
    const PositionManager = await ethers.getContractFactory('PositionManager');

    PositionManagerInstance = await PositionManager.deploy(owner.address, NonFungiblePositionManager.address);

    await PositionManagerInstance.deployed();
  });

  describe('NonfungiblePositionToken deployed correctly', function () {
    it('Should correctly initialize constructor', async function () {
      expect(await NonFungiblePositionManager.signer.getAddress()).to.equal(owner.address);
    });
    it('Should mint a NFT, with id with all the correct data', async function () {
      const tx = await NonFungiblePositionManager.mint(
        [
          token0.address,
          token1.address,
          3000,
          -240060,
          -239940,
          '0x' + (3e6).toString(16),
          '0x' + (1e18).toString(16),
          0,
          0,
          signers[0].address,
          Date.now() + 1000,
        ],

        { from: signers[0].address, gasLimit: 670000 }
      );

      const receipt = await tx.wait();
      const data = receipt.events[receipt.events.length - 1].args;
      expect(data.tokenId).to.equal(2);
    });
  });

  describe('Deploy correctly', function () {
    it('Should correcly initialize constructor', async function () {
      // @ts-ignore
      expect(await PositionManagerInstance.owner()).to.equal(owner.address);
    });

    it('Should deposit nft in smart vault', async function () {
      const tx = await NonFungiblePositionManager.mint(
        //ERC721
        [
          token0.address,
          token1.address,
          3000,
          -240060,
          -239940,
          '0x' + (1e15).toString(16),
          '0x' + (3e3).toString(16),
          0,
          0,
          signers[0].address,
          Date.now() + 1000,
        ],

        { from: signers[0].address, gasLimit: 670000 }
      );

      const receipt = await tx.wait();
      const data = receipt.events[receipt.events.length - 1].args;
      const tokenId = data.tokenId;
      await NonFungiblePositionManager.setApprovalForAll(PositionManagerInstance.address, true);
      await PositionManagerInstance.depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), tokenId);
      expect(await PositionManagerInstance.address).to.equal(await NonFungiblePositionManager.ownerOf(tokenId));
    });

    it('Should close and burn a uniPosition', async function () {
      const tx = await NonFungiblePositionManager.mint(
        //ERC721
        [
          token0.address,
          token1.address,
          3000,
          -240060,
          -239940,
          '0x' + (1e15).toString(16),
          '0x' + (3e3).toString(16),
          0,
          0,
          signers[0].address,
          Date.now() + 1000,
        ],

        { from: signers[0].address, gasLimit: 670000 }
      );
      const receipt = await tx.wait();
      const data = receipt.events[receipt.events.length - 1].args;
      const tokenId = data.tokenId;

      await NonFungiblePositionManager.setApprovalForAll(PositionManagerInstance.address, true);
      await PositionManagerInstance.depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), tokenId);

      const res = await PositionManagerInstance.closeUniPosition(tokenId);
    });

    it('Should close and burn a uniPosition with swap fees', async function () {
      const tx = await NonFungiblePositionManager.mint(
        //ERC721
        [
          token0.address,
          token1.address,
          3000,
          -240000 - 60 * 100,
          -239940 + 60 * 100,
          '0x' + (1e20).toString(16),
          '0x' + (1e20).toString(16),
          0,
          0,
          signers[0].address,
          Date.now() + 1000,
        ],

        { from: signers[0].address, gasLimit: 670000 }
      );

      const receipt = await tx.wait();
      const data = receipt.events[receipt.events.length - 1].args;
      const tokenId = data.tokenId;

      await NonFungiblePositionManager.setApprovalForAll(PositionManagerInstance.address, true);
      await PositionManagerInstance.depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), tokenId);

      //const res = await PositionManagerInstance.closeUniPosition(tokenId);
      const trader = signers[2];
      let tick;
      let sqrtPriceX96;
      ({ tick, sqrtPriceX96 } = await poolI.slot0());
      console.log(tick);
      let isEven;
      let sign;

      // Do some trades to accrue fees
      for (let i = 0; i < 20; i++) {
        // @ts-ignore
        sign = i % 2 == 0;
        await router.connect(trader).swap(poolI.address, sign, 1e15);
        ({ tick, sqrtPriceX96 } = await poolI.slot0());
      }

      // Fees are updated at every interaction with the position
      // ex. IncreaseLiquidity, DecreaseLiquidity
      // so here have to use PositionManager.function to account for fees

      let position = await NonFungiblePositionManager.positions(tokenId);
      console.log(position);
    });
  });
});
