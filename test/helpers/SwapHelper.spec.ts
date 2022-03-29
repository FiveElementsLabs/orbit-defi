import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';
const hre = require('hardhat');

describe('SwapHelper.sol', function () {
  //GLOBAL VARIABLE - USE THIS
  let user: any = ethers.getSigners().then(async (signers) => {
    return signers[0];
  });

  let SwapHelper: any;
  let MockSwapHelper: Contract;

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    user = await user; //owner of the smart vault, a normal user

    //deploy swapHelper library and contract to test it
    const SwapHelperFactory = await ethers.getContractFactory('SwapHelper');
    SwapHelper = await SwapHelperFactory.deploy();
    await SwapHelper.deployed();

    const MockSwapHelperFactory = await ethers.getContractFactory('MockSwapHelper', {
      libraries: {
        SwapHelper: SwapHelper.address,
      },
    });
    MockSwapHelper = await MockSwapHelperFactory.deploy();
    await MockSwapHelper.deployed();
  });

  describe('getRatioFromRange', function () {
    it('should calculate ratio=1 correctly', async function () {
      const tickPool = 0;
      const tickLower = -300;
      const tickUpper = 300;
      const ratioE18 = await MockSwapHelper.getRatioFromRange(tickPool, tickLower, tickUpper);
      expect(ratioE18.div(1e9).toNumber() / 1e9).to.be.closeTo(1, 1e-8);
    });

    it('should calculate ratio in the right direction', async function () {
      const tickPool = 0;
      const tickLower = -20;
      const tickUpper = 600;
      const ratioE18 = await MockSwapHelper.getRatioFromRange(tickPool, tickLower, tickUpper);
      expect(ratioE18.div(1e9).toNumber() / 1e9).to.gt(0);
      expect(ratioE18.div(1e9).toNumber() / 1e9).to.lt(1);
    });

    it('should revert if position if out of range', async function () {
      const tickPool = -400;
      const tickLower = -20;
      const tickUpper = 600;
      await expect(MockSwapHelper.getRatioFromRange(tickPool, tickLower, tickUpper)).to.be.reverted;
    });
  });

  describe('calcAmountToSwap', function () {
    it('should swap all to one token if poolTick is under tickLower', async function () {
      const tickPool = -400;
      const tickLower = -20;
      const tickUpper = 600;
      const amount0In = '0x' + (1e5).toString(16);
      const amount1In = '0x' + (5e5).toString(16);
      const [amountToSwap, token0In] = await MockSwapHelper.calcAmountToSwap(
        tickPool,
        tickLower,
        tickUpper,
        amount0In,
        amount1In
      );
      expect(amountToSwap).to.equal(amount0In);
      expect(token0In).to.equal(true);
    });

    it('should swap all to one token if poolTick is over tickUpper', async function () {
      const tickPool = 800;
      const tickLower = -20;
      const tickUpper = 600;
      const amount0In = '0x' + (1e5).toString(16);
      const amount1In = '0x' + (5e5).toString(16);
      const [amountToSwap, token0In] = await MockSwapHelper.calcAmountToSwap(
        tickPool,
        tickLower,
        tickUpper,
        amount0In,
        amount1In
      );
      expect(amountToSwap).to.equal(amount1In);
      expect(token0In).to.equal(false);
    });

    it('should calculate amount to swap to 50/50 if amount1 is higher', async function () {
      const tickPool = 0;
      const tickLower = -300;
      const tickUpper = 300;
      const amount0In = 1e5;
      const amount1In = 5e5;
      const [amountToSwap, token0In] = await MockSwapHelper.calcAmountToSwap(
        tickPool,
        tickLower,
        tickUpper,
        amount0In,
        amount1In
      );
      expect(amountToSwap.toNumber()).to.be.closeTo((amount1In - amount0In) / 2, (amount1In - amount0In) / 1e4);
      expect(token0In).to.equal(false);
    });

    it('should calculate amount to swap to 50/50 if amount0 is higher', async function () {
      const tickPool = 0;
      const tickLower = -300;
      const tickUpper = 300;
      const amount0In = 1e6;
      const amount1In = 5e5;
      const [amountToSwap, token0In] = await MockSwapHelper.calcAmountToSwap(
        tickPool,
        tickLower,
        tickUpper,
        amount0In,
        amount1In
      );
      expect(amountToSwap.toNumber()).to.be.closeTo((amount0In - amount1In) / 2, (amount0In - amount1In) / 1e4);
      expect(token0In).to.equal(true);
    });

    it('should revert if negative amounts are passed', async function () {
      const tickPool = 0;
      const tickLower = -300;
      const tickUpper = 300;
      const amount0In = -1e6;
      const amount1In = 5e5;
      await expect(MockSwapHelper.calcAmountToSwap(tickPool, tickLower, tickUpper, amount0In, amount1In)).to.be
        .reverted;
    });

    it('should work if zero amounts are passed', async function () {
      const tickPool = 0;
      const tickLower = -300;
      const tickUpper = 300;
      const amount0In = 0;
      const amount1In = 5e5;
      await MockSwapHelper.calcAmountToSwap(tickPool, tickLower, tickUpper, amount0In, amount1In);
    });

    it('should revert if both amount are zero', async function () {
      const tickPool = 0;
      const tickLower = -300;
      const tickUpper = 300;
      const amount0In = 0;
      const amount1In = 0;
      await expect(MockSwapHelper.calcAmountToSwap(tickPool, tickLower, tickUpper, amount0In, amount1In)).to.be
        .reverted;
    });
  });
});
