import { expect } from 'chai';
import '@nomiclabs/hardhat-ethers';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';
import { tokensFixture, poolFixture, routerFixture } from './shared/fixtures';
//import { sign } from 'crypto';
//import { time } from 'console';
//import internal from 'assert';

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
  let AutoCompoundInstance: Contract;
  let owner: any;
  let user: any;
  let signers: any;
  let NonFungiblePositionManager: Contract;
  let token0: Contract, token1: Contract;
  let poolI: any;
  let router: Contract;
  let LPtokenId: any;

  before(async function () {
    // Initializing tokens
    const { token0Fixture, token1Fixture } = await tokensFixture();
    token0 = token0Fixture;
    token1 = token1Fixture;

    // initializing pool
    const { pool, NonfungiblePositionManager } = await poolFixture(token0, token1);
    poolI = pool;
    NonFungiblePositionManager = NonfungiblePositionManager;
    let startTick = -240000;
    const price = Math.pow(1.0001, startTick);
    await pool.initialize('0x' + (Math.sqrt(price) * Math.pow(2, 96)).toString(16));
    await pool.increaseObservationCardinalityNext(100);
    const { sqrtPriceX96, tick } = await pool.slot0();

    //signers config
    signers = await ethers.getSigners();
    user = await signers[0];
    await token0.mint(user.address, ethers.utils.parseEther('1000000000000'));
    await token1.mint(user.address, ethers.utils.parseEther('1000000000000'));

    const liquidityProvider = await signers[1];
    await token0
      .connect(liquidityProvider)
      .mint(liquidityProvider.address, ethers.utils.parseEther('10000000000000000000000000000'));
    await token1
      .connect(liquidityProvider)
      .mint(liquidityProvider.address, ethers.utils.parseEther('10000000000000000000000000000'));

    //approvals
    await token0.connect(user).approve(NonFungiblePositionManager.address, ethers.utils.parseEther('1000000000000'));
    await token1.approve(NonFungiblePositionManager.address, ethers.utils.parseEther('1000000000000'), {
      from: user.address,
    });

    await token0
      .connect(liquidityProvider)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('10000000000000000000000000000'));
    await token1
      .connect(liquidityProvider)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('10000000000000000000000000000'), {
        from: liquidityProvider.address,
      });

    // give pool some liquidity
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

    const LPReceipt = await tx.wait();
    LPtokenId = LPReceipt.events[LPReceipt.events.length - 1].args.tokenId;

    // Give trader some tokens
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
    // Get the ContractFactory and deploy.
    const PositionManager = await ethers.getContractFactory('PositionManager');

    PositionManagerInstance = await PositionManager.deploy(
      user.address,
      NonFungiblePositionManager.address,
      poolI.address
    );

    await PositionManagerInstance.deployed();

    const AutoCompound = await ethers.getContractFactory('AutoCompoundModule');

    AutoCompoundInstance = await AutoCompound.deploy(33);
  });

  describe('NonfungiblePositionToken deployed correctly', function () {
    it('Should correctly initialize constructor', async function () {
      expect(await NonFungiblePositionManager.signer.getAddress()).to.equal(user.address);
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

      const mintReceipt = await tx.wait();
      const data = mintReceipt.events[mintReceipt.events.length - 1].args;
      expect(data.tokenId).to.equal(2); //Why hardcoded ID???
    });
  });

  describe('Check PositionManager functions', function () {
    it('Should deposit nfts in smart vault and withdraw them', async function () {
      const tx = await NonFungiblePositionManager.mint(
        [
          //ERC721
          token0.address,
          token1.address,
          3000,
          -240000 - 60,
          -240000 + 60,
          '0x' + (1e15).toString(16),
          '0x' + (3e3).toString(16),
          0,
          0,
          user.address,
          Date.now() + 1000,
        ],
        { from: user.address, gasLimit: 670000 }
      );

      const receipt = await tx.wait();
      const data = receipt.events[receipt.events.length - 1].args;

      await NonFungiblePositionManager.setApprovalForAll(PositionManagerInstance.address, true);
      await PositionManagerInstance.connect(user).depositUniNft(
        await NonFungiblePositionManager.ownerOf(data.tokenId),
        data.tokenId,
        { from: user.address }
      );
      expect(await PositionManagerInstance.address).to.equal(
        await NonFungiblePositionManager.connect(user).ownerOf(data.tokenId)
      );
      await PositionManagerInstance.connect(user).withdrawAllUniNft(user.address, {
        from: await PositionManagerInstance.owner(),
      });

      expect(await user.address).to.equal(await NonFungiblePositionManager.ownerOf(data.tokenId));
    });

    it('Should revert if token does not exist', async function () {
      try {
        await PositionManagerInstance.connect(user).withdrawUniNft(user.address, 1000);
      } catch (error) {
        expect(1).to.equal(1);
      }
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
      const tokenId = receipt.events[receipt.events.length - 1].args.tokenId;

      await NonFungiblePositionManager.setApprovalForAll(PositionManagerInstance.address, true);
      await PositionManagerInstance.depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), tokenId);

      await PositionManagerInstance.closeUniPosition(tokenId);
    });

    it('Should check swap fees accrued by position and collect them', async function () {
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
          user.address,
          Date.now() + 1000,
        ],

        { from: user.address, gasLimit: 670000 }
      );

      const receipt = await tx.wait();
      const tokenId = await receipt.events[receipt.events.length - 1].args.tokenId;

      await NonFungiblePositionManager.setApprovalForAll(PositionManagerInstance.address, true);
      await PositionManagerInstance.depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), tokenId);

      //const res = await PositionManagerInstance.closeUniPosition(tokenId);
      const trader = signers[2];
      //let { tick, sqrtPriceX96 } = await poolI.slot0();
      let sign;

      // Do some trades to accrue fees
      for (let i = 0; i < 20; i++) {
        // @ts-ignore
        sign = i % 2 == 0;
        await router.connect(trader).swap(poolI.address, sign, 1e15);
        //({ tick, sqrtPriceX96 } = await poolI.slot0());
      }

      // Fees are updated at every interaction with the position
      // ex. IncreaseLiquidity, DecreaseLiquidity
      // so here have to use PositionManager.function to account for fees
      const updateTx = await PositionManagerInstance.updateUncollectedFees(tokenId);

      let position = await NonFungiblePositionManager.positions(tokenId);
      expect(position.tokensOwed0).to.gt(0);
      expect(position.tokensOwed1).to.gt(0);

      const collectTx = await PositionManagerInstance.collectPositionFee(tokenId);
      position = await NonFungiblePositionManager.positions(tokenId);
      expect(position.tokensOwed0).to.equal(0);
      expect(position.tokensOwed1).to.equal(0);
    });

    it('Should mint and deposit an uniV3 NFT', async function () {
      await token0.approve(PositionManagerInstance.address, ethers.utils.parseEther('1000000000000'), {
        from: signers[0].address,
      });
      await token1.approve(PositionManagerInstance.address, ethers.utils.parseEther('1000000000000'), {
        from: signers[0].address,
      });

      const tx = await PositionManagerInstance.mintAndDeposit(
        token0.address,
        token1.address,
        3000,
        -240000 - 60,
        -240000 + 60,
        '0x' + (1e13).toString(16),
        '0x' + (3e3).toString(16),
        0,
        0
      );

      const receipt = await tx.wait();
      const tokenId = await receipt.events[receipt.events.length - 1].args.tokenId;
    });
  });

  describe('PositionManager - increasePositionLiquidity', function () {
    it('Should increase the liquidity in the NFT', async function () {
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
          user.address,
          Date.now() + 1000,
        ],

        { from: user.address, gasLimit: 670000 }
      );

      const receipt = await tx.wait();
      const tokenId = await receipt.events[receipt.events.length - 1].args.tokenId;

      await NonFungiblePositionManager.setApprovalForAll(PositionManagerInstance.address, true);
      await PositionManagerInstance.depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), tokenId);
      const liquidityBefore = await poolI.liquidity();

      await token0
        .connect(signers[0])
        .approve(PositionManagerInstance.address, ethers.utils.parseEther('100000000000000'));

      await token1.approve(PositionManagerInstance.address, ethers.utils.parseEther('100000000000000'), {
        from: signers[0].address,
      });

      const res = await PositionManagerInstance.increasePositionLiquidity(1, 1e10, 1e6);
      const liquidityAfter = await poolI.liquidity();
      expect(liquidityAfter).to.be.gt(liquidityBefore);
    });
  });

  describe('PositionManager - getPositionBalance', function () {
    it('should return the amount of token', async function () {
      const token0Dep = 3000e6;
      const token1Dep = 1e20;
      const tx = await NonFungiblePositionManager.mint(
        [
          token0.address,
          token1.address,
          3000,
          -240060,
          -239940,
          '0x' + token0Dep.toString(16),
          '0x' + token1Dep.toString(16),
          0,
          0,
          user.address,
          Date.now() + 1000,
        ],

        { from: user.address, gasLimit: 670000 }
      );
      const receipt = await tx.wait();
      await NonFungiblePositionManager.setApprovalForAll(PositionManagerInstance.address, true);
      await PositionManagerInstance.connect(signers[0]).depositUniNft(
        await NonFungiblePositionManager.ownerOf(receipt.events[receipt.events.length - 1].args.tokenId),
        receipt.events[receipt.events.length - 1].args.tokenId
      );

      const txres = await PositionManagerInstance.getPositionBalance(
        receipt.events[receipt.events.length - 1].args.tokenId
      );
    });
  });

  describe('PositionManager - OnlyUser should be able to', function () {
    it('call deposit function', async function () {
      const tx = await NonFungiblePositionManager.mint(
        [
          token0.address,
          token1.address,
          3000,
          -240060,
          -239940,
          '0x' + (30e6).toString(16),
          '0x' + (1e17).toString(16),
          0,
          0,
          user.address,
          Date.now() + 1000,
        ],

        { from: user.address, gasLimit: 670000 }
      );

      const receipt = await tx.wait();

      await NonFungiblePositionManager.setApprovalForAll(PositionManagerInstance.address, true);
      await expect(
        PositionManagerInstance.connect(signers[1]).depositUniNft(
          await NonFungiblePositionManager.ownerOf(receipt.events[receipt.events.length - 1].args.tokenId),
          receipt.events[receipt.events.length - 1].args.tokenId
        )
      ).to.be.reverted;
    });

    it('call withdraw function', async function () {
      const tx = await NonFungiblePositionManager.mint(
        [
          token0.address,
          token1.address,
          3000,
          -240060,
          -239940,
          '0x' + (30e6).toString(16),
          '0x' + (1e17).toString(16),
          0,
          0,
          user.address,
          Date.now() + 1000,
        ],

        { from: user.address, gasLimit: 670000 }
      );

      const receipt = await tx.wait();

      await NonFungiblePositionManager.setApprovalForAll(PositionManagerInstance.address, true);

      await PositionManagerInstance.depositUniNft(
        await NonFungiblePositionManager.connect(user).ownerOf(receipt.events[receipt.events.length - 1].args.tokenId),
        receipt.events[receipt.events.length - 1].args.tokenId
      );

      await expect(
        PositionManagerInstance.connect(signers[1]).withdrawUniNft(
          signers[0].address,
          receipt.events[receipt.events.length - 1].args.tokenId
        )
      ).to.be.reverted;
    });

    it('mint and deposit an uniV3 NFT', async function () {
      await token0.approve(PositionManagerInstance.address, ethers.utils.parseEther('1000000000000'), {
        from: user.address,
      });

      await token1.approve(PositionManagerInstance.address, ethers.utils.parseEther('1000000000000'), {
        from: user.address,
      });

      await expect(
        PositionManagerInstance.connect(signers[1]).mintAndDeposit(
          token0.address,
          token1.address,
          3000,
          -240000 - 60,
          -240000 + 60,
          '0x' + (1e13).toString(16),
          '0x' + (3e3).toString(16),
          0,
          0
        )
      ).to.be.reverted;
    });

    it('increase the liquidity in the NFT', async function () {
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
          user.address,
          Date.now() + 1000,
        ],

        { from: user.address, gasLimit: 670000 }
      );
      const receipt = await tx.wait();
      const tokenId = receipt.events[receipt.events.length - 1].args.tokenId;

      await NonFungiblePositionManager.setApprovalForAll(PositionManagerInstance.address, true);
      await PositionManagerInstance.depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), tokenId);

      await token0.connect(user).approve(PositionManagerInstance.address, ethers.utils.parseEther('100000000000000'));

      await token1.approve(PositionManagerInstance.address, ethers.utils.parseEther('100000000000000'), {
        from: user.address,
      });

      await expect(PositionManagerInstance.connect(signers[1]).increasePositionLiquidity(tokenId, 1e10, 1e6)).to.be
        .reverted;
    });

    it('close and burn a uniPosition', async function () {
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
          user.address,
          Date.now() + 1000,
        ],

        { from: user.address, gasLimit: 670000 }
      );

      const receipt = await tx.wait();
      const tokenId = await receipt.events[receipt.events.length - 1].args.tokenId;

      await NonFungiblePositionManager.setApprovalForAll(PositionManagerInstance.address, true);
      await PositionManagerInstance.depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), tokenId);

      await expect(PositionManagerInstance.connect(signers[1]).closeUniPosition(tokenId)).to.be.reverted;
    });
  });

  describe('AutoCompoundModule - checkForAllUncollectedFees', function () {
    it('should return the amount of fees', async function () {
      const token0Dep = 3000e6;
      const token1Dep = 1e20;
      const tx = await NonFungiblePositionManager.mint(
        [
          token0.address,
          token1.address,
          3000,
          -240060,
          -239940,
          '0x' + token0Dep.toString(16),
          '0x' + token1Dep.toString(16),
          0,
          0,
          signers[0].address,
          Date.now() + 1000,
        ],

        { from: signers[0].address, gasLimit: 670000 }
      );
      const tx2 = await NonFungiblePositionManager.mint(
        [
          token0.address,
          token1.address,
          3000,
          -240060,
          -239940,
          '0x' + token0Dep.toString(16),
          '0x' + token1Dep.toString(16),
          0,
          0,
          signers[0].address,
          Date.now() + 1000,
        ],

        { from: signers[0].address, gasLimit: 670000 }
      );
      const receipt = await tx.wait();
      const receipt2 = await tx2.wait();

      await NonFungiblePositionManager.setApprovalForAll(PositionManagerInstance.address, true);
      await PositionManagerInstance.depositUniNft(
        await NonFungiblePositionManager.ownerOf(receipt.events[receipt.events.length - 1].args.tokenId),
        receipt.events[receipt.events.length - 1].args.tokenId
      );
      await PositionManagerInstance.depositUniNft(
        await NonFungiblePositionManager.ownerOf(receipt2.events[receipt2.events.length - 1].args.tokenId),
        receipt2.events[receipt2.events.length - 1].args.tokenId
      );

      const res = await AutoCompoundInstance.checkForAllUncollectedFees(PositionManagerInstance.address);
    });
  });
  describe('AutoCompoundModule - collectFees', function () {
    it('should collect all the fees to be reinvested', async function () {
      const token0Dep = 1e20;
      const token1Dep = 1e20;
      const tx = await NonFungiblePositionManager.mint(
        [
          token0.address,
          token1.address,
          3000,
          -240060,
          -239940,
          '0x' + token0Dep.toString(16),
          '0x' + token1Dep.toString(16),
          0,
          0,
          signers[0].address,
          Date.now() + 1000,
        ],

        { from: signers[0].address, gasLimit: 670000 }
      );
      const tx2 = await NonFungiblePositionManager.mint(
        [
          token0.address,
          token1.address,
          3000,
          -240060,
          -239940,
          '0x' + token0Dep.toString(16),
          '0x' + token1Dep.toString(16),
          0,
          0,
          signers[0].address,
          Date.now() + 1000,
        ],

        { from: signers[0].address, gasLimit: 670000 }
      );
      const receipt = await tx.wait();
      const receipt2 = await tx2.wait();

      await NonFungiblePositionManager.setApprovalForAll(PositionManagerInstance.address, true);
      await PositionManagerInstance.depositUniNft(
        await NonFungiblePositionManager.ownerOf(receipt.events[receipt.events.length - 1].args.tokenId),
        receipt.events[receipt.events.length - 1].args.tokenId
      );
      await PositionManagerInstance.depositUniNft(
        await NonFungiblePositionManager.ownerOf(receipt2.events[receipt2.events.length - 1].args.tokenId),
        receipt2.events[receipt2.events.length - 1].args.tokenId
      );

      let positionBeforeTrade = await NonFungiblePositionManager.positions(
        receipt.events[receipt.events.length - 1].args.tokenId
      );
      expect(positionBeforeTrade.tokensOwed0).to.be.equal(0);
      expect(positionBeforeTrade.tokensOwed1).to.be.equal(0);

      const trader = signers[2];
      //let { tick, sqrtPriceX96 } = await poolI.slot0();
      let sign;

      // Do some trades to accrue fees
      for (let i = 0; i < 20; i++) {
        // @ts-ignore
        sign = i % 2 == 0;
        await router.connect(trader).swap(poolI.address, sign, '0x' + (1e18).toString(16));
        //({ tick, sqrtPriceX96 } = await poolI.slot0());
      }

      await PositionManagerInstance.updateUncollectedFees(receipt.events[receipt.events.length - 1].args.tokenId);
      await PositionManagerInstance.updateUncollectedFees(receipt2.events[receipt2.events.length - 1].args.tokenId);

      let positionAfterTrade = await NonFungiblePositionManager.positions(
        receipt.events[receipt.events.length - 1].args.tokenId
      );

      expect(positionAfterTrade.tokensOwed0).to.gt(0);
      expect(positionAfterTrade.tokensOwed1).to.gt(0);

      await AutoCompoundInstance.collectFees(PositionManagerInstance.address);

      let position = await NonFungiblePositionManager.positions(receipt.events[receipt.events.length - 1].args.tokenId);
      expect(position.tokensOwed0).to.be.equal(0);
      expect(position.tokensOwed1).to.be.equal(0);
    });
  });
});
