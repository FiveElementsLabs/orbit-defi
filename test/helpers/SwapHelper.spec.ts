import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ContractFactory, Contract } from 'ethers';
const UniswapV3Factoryjson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');
const NonFungiblePositionManagerjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');
const NonFungiblePositionManagerDescriptorjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json');
const PositionManagerjson = require('../../artifacts/contracts/PositionManager.sol/PositionManager.json');
const SwapRouterjson = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json');
const FixturesConst = require('../shared/fixtures');
const hre = require('hardhat');

import { ethers } from 'hardhat';
import { tokensFixture, poolFixture, mintSTDAmount, routerFixture } from '../shared/fixtures';

import { MockToken, IUniswapV3Pool, INonfungiblePositionManager, PositionManager, TestRouter } from '../../typechain';
import { getContractFactory } from '@nomiclabs/hardhat-ethers/types';
import { AnyTxtRecord } from 'dns';

describe('PositionManager.sol', function () {
  //GLOBAL VARIABLE - USE THIS
  let user: any = ethers.getSigners().then(async (signers) => {
    return signers[0];
  });
  let liquidityProvider: any = ethers.getSigners().then(async (signers) => {
    return signers[1];
  });
  let trader: any = ethers.getSigners().then(async (signers) => {
    return signers[2];
  });

  //all the token used globally
  let tokenEth: MockToken, tokenUsdc: MockToken, tokenDai: MockToken;

  //all the pools used globally
  let Pool0: IUniswapV3Pool, Pool1: IUniswapV3Pool;

  //tokenId used globally on all test
  let tokenId: any;

  let Factory: Contract; // the factory that will deploy all pools
  let NonFungiblePositionManager: INonfungiblePositionManager; // NonFungiblePositionManager contract by UniswapV3
  let PositionManager: PositionManager; //Our smart vault named PositionManager
  let Router: TestRouter; //Our router to perform swap
  let SwapRouter: Contract;
  let SwapHelper: any;
  let MockSwapHelper: Contract;

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    user = await user; //owner of the smart vault, a normal user
    liquidityProvider = await liquidityProvider; //generic address as other users, mint pool liquidity, try to do onlyUser call etc
    trader = await trader; //used for swap

    //deploy first 3 token - ETH, USDC, DAI
    tokenEth = await tokensFixture('ETH', 18).then((tokenFix) => tokenFix.tokenFixture);
    tokenUsdc = await tokensFixture('USDC', 6).then((tokenFix) => tokenFix.tokenFixture);
    tokenDai = await tokensFixture('DAI', 18).then((tokenFix) => tokenFix.tokenFixture);

    //deploy factory, used for pools
    const uniswapFactoryFactory = new ContractFactory(
      UniswapV3Factoryjson['abi'],
      UniswapV3Factoryjson['bytecode'],
      user
    );
    Factory = (await uniswapFactoryFactory.deploy().then((contract) => contract.deployed())) as Contract;

    //deploy first 2 pools
    Pool0 = await poolFixture(tokenEth, tokenUsdc, 3000, Factory).then((poolFix) => poolFix.pool);
    Pool1 = await poolFixture(tokenEth, tokenDai, 3000, Factory).then((poolFix) => poolFix.pool);

    //mint 1e30 token, you can call with arbitrary amount
    await mintSTDAmount(tokenEth);
    await mintSTDAmount(tokenUsdc);
    await mintSTDAmount(tokenDai);

    //deploy NonFungiblePositionManagerDescriptor and NonFungiblePositionManager
    const NonFungiblePositionManagerDescriptorFactory = new ContractFactory(
      NonFungiblePositionManagerDescriptorjson['abi'],
      FixturesConst.NonFungiblePositionManagerDescriptorBytecode,
      user
    );
    const NonFungiblePositionManagerDescriptor = await NonFungiblePositionManagerDescriptorFactory.deploy(
      tokenEth.address,
      ethers.utils.formatBytes32String('www.google.com')
    ).then((contract) => contract.deployed());

    const NonFungiblePositionManagerFactory = new ContractFactory(
      NonFungiblePositionManagerjson['abi'],
      NonFungiblePositionManagerjson['bytecode'],
      user
    );
    NonFungiblePositionManager = (await NonFungiblePositionManagerFactory.deploy(
      Factory.address,
      tokenEth.address,
      NonFungiblePositionManagerDescriptor.address
    ).then((contract) => contract.deployed())) as INonfungiblePositionManager;

    //deploy router
    const SwapRouterFactory = new ContractFactory(SwapRouterjson['abi'], SwapRouterjson['bytecode'], user);
    //Router = await routerFixture().then((RFixture) => RFixture.ruoterDeployFixture);
    SwapRouter = (await SwapRouterFactory.deploy(Factory.address, tokenEth.address).then((contract) =>
      contract.deployed()
    )) as Contract;

    //deploy the PositionManagerFactory => deploy PositionManager
    const PositionManagerFactory = await ethers
      .getContractFactory('PositionManagerFactory')
      .then((contract) => contract.deploy().then((deploy) => deploy.deployed()));

    await PositionManagerFactory.create(user.address, NonFungiblePositionManager.address, SwapRouter.address);

    const contractsDeployed = await PositionManagerFactory.positionManagers(0);
    PositionManager = (await ethers.getContractAt(PositionManagerjson['abi'], contractsDeployed)) as PositionManager;

    //APPROVE
    //recipient: NonFungiblePositionManager - spender: user
    await tokenEth
      .connect(user)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc
      .connect(user)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    await tokenDai
      .connect(user)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    //recipient: NonFungiblePositionManager - spender: liquidityProvider
    await tokenEth
      .connect(liquidityProvider)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc
      .connect(liquidityProvider)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    await tokenDai
      .connect(liquidityProvider)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    //recipient: PositionManager - spender: user
    await tokenEth.connect(user).approve(PositionManager.address, ethers.utils.parseEther('1000000000000'));
    await tokenUsdc.connect(user).approve(PositionManager.address, ethers.utils.parseEther('1000000000000'));
    await tokenDai.connect(user).approve(PositionManager.address, ethers.utils.parseEther('1000000000000'));
    //recipient: Router - spender: trader
    await tokenEth.connect(trader).approve(SwapRouter.address, ethers.utils.parseEther('1000000000000'));
    await tokenUsdc.connect(trader).approve(SwapRouter.address, ethers.utils.parseEther('1000000000000'));
    await tokenDai.connect(trader).approve(SwapRouter.address, ethers.utils.parseEther('1000000000000'));
    //recipient: Pool0 - spender: trader
    await tokenEth.connect(trader).approve(Pool0.address, ethers.utils.parseEther('1000000000000'));
    await tokenUsdc.connect(trader).approve(Pool0.address, ethers.utils.parseEther('1000000000000'));
    await tokenDai.connect(trader).approve(Pool0.address, ethers.utils.parseEther('1000000000000'));

    await NonFungiblePositionManager.setApprovalForAll(PositionManager.address, true);

    // give pool some liquidity
    await NonFungiblePositionManager.connect(liquidityProvider).mint(
      {
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 3000,
        tickLower: 0 - 60 * 1000,
        tickUpper: 0 + 60 * 1000,
        amount0Desired: '0x' + (1e26).toString(16),
        amount1Desired: '0x' + (1e26).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: liquidityProvider.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );

    //deploy swapHelper library and contract to test it
    SwapHelper = await ethers
      .getContractFactory('SwapHelper')
      .then((contract) => contract.deploy().then((deploy) => deploy.deployed()));

    MockSwapHelper = await ethers
      .getContractFactory('MockSwapHelper', {
        libraries: {
          SwapHelper: SwapHelper.address,
        },
      })
      .then((contract) => contract.deploy().then((deploy) => deploy.deployed()));
  });

  beforeEach(async function () {
    const txMint = await NonFungiblePositionManager.connect(user).mint(
      {
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 3000,
        tickLower: 0 - 60 * 1000,
        tickUpper: 0 + 60 * 1000,
        amount0Desired: '0x' + (1e18).toString(16),
        amount1Desired: '0x' + (1e18).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: user.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );

    tokenId = await txMint
      .wait()
      .then((mintReceipt: any) => mintReceipt.events[mintReceipt.events.length - 1].args.tokenId);
  });

  describe('SwapHelper.sol - getRatioFromRange', function () {
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

  describe('SwapHelper.sol - calcAmountToSwap', function () {
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
  });
});
