import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ContractFactory, Contract } from 'ethers';
const UniswapV3Factoryjson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');
const NonFungiblePositionManagerjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');
const NonFungiblePositionManagerDescriptorjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json');
const PositionManagerjson = require('../artifacts/contracts/PositionManager.sol/PositionManager.json');
const FixturesConst = require('./shared/fixtures');

import { ethers } from 'hardhat';
import { tokensFixture, poolFixture, mintSTDAmount, routerFixture } from './shared/fixtures';

import {
  MockToken,
  IUniswapV3Pool,
  INonfungiblePositionManager,
  PositionManager,
  AutoCompoundModule,
  TestRouter,
} from '../typechain';

describe('AutoCompoundModule.sol', function () {
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
  let Router: TestRouter; //Our router to perform swaps
  let AutoCompoundModule: AutoCompoundModule; //module for autoCompound features

  before(async function () {
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

    //deploy the PositionManagerFactory => deploy PositionManager
    const PositionManagerFactory = await ethers
      .getContractFactory('PositionManagerFactory')
      .then((contract) => contract.deploy().then((deploy) => deploy.deployed()));

    await PositionManagerFactory.create(user.address, NonFungiblePositionManager.address, Pool0.address);

    const contractsDeployed = await PositionManagerFactory.positionManagers(0);
    PositionManager = (await ethers.getContractAt(PositionManagerjson['abi'], contractsDeployed)) as PositionManager;

    //deploy router
    Router = await routerFixture().then((RFixture) => RFixture.ruoterDeployFixture);

    //deploy AutoCompoundModule
    AutoCompoundModule = (await ethers
      .getContractFactory('AutoCompoundModule')
      .then((contract) => contract.deploy(33).then((deploy) => deploy.deployed()))) as AutoCompoundModule;

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
    await tokenEth.connect(trader).approve(Router.address, ethers.utils.parseEther('1000000000000'));
    await tokenUsdc.connect(trader).approve(Router.address, ethers.utils.parseEther('1000000000000'));
    await tokenDai.connect(trader).approve(Router.address, ethers.utils.parseEther('1000000000000'));
    //recipient: Pool0 - spender: trader
    await tokenEth.connect(trader).approve(Pool0.address, ethers.utils.parseEther('1000000000000'));
    await tokenUsdc.connect(trader).approve(Pool0.address, ethers.utils.parseEther('1000000000000'));
    await tokenDai.connect(trader).approve(Pool0.address, ethers.utils.parseEther('1000000000000'));
    /* //recipient: NonFungiblePositionManager - spender: PositionManager
    await tokenEth
      .connect(PositionManager.address)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('1000000000000'));
    await tokenUsdc
      .connect(PositionManager.address)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('1000000000000'));
    await tokenDai
      .connect(PositionManager.address)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('1000000000000')); */

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

  describe('AutoCompoundModule - checkForAllUncollectedFees', function () {
    it('should return the amount of fees', async function () {
      const token0Dep = 1e18;
      const token1Dep = 1e18;

      const tx2 = await NonFungiblePositionManager.connect(user).mint({
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 3000,
        tickLower: 0 - 60 * 1,
        tickUpper: 0 + 60 * 1,
        amount0Desired: '0x' + token0Dep.toString(16),
        amount1Desired: '0x' + token1Dep.toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: user.address,
        deadline: Date.now() + 1000,
      });

      const receipt2: any = await tx2.wait();
      await NonFungiblePositionManager.setApprovalForAll(PositionManager.address, true);
      await PositionManager.depositUniNft(user.address, [
        tokenId,
        receipt2.events[receipt2.events.length - 1].args.tokenId,
      ]);

      const res = await AutoCompoundModule.checkForAllUncollectedFees(PositionManager.address);
    });
  });

  describe('AutoCompoundModule - collectFees', function () {
    it('should collect all the fees to be reinvested', async function () {
      const token0Dep = 1e27;
      const token1Dep = 1e27;
      const tx2 = await NonFungiblePositionManager.connect(user).mint({
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 3000,
        tickLower: 0 - 60 * 1,
        tickUpper: 0 + 60 * 1,
        amount0Desired: '0x' + token0Dep.toString(16),
        amount1Desired: '0x' + token1Dep.toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: user.address,
        deadline: Date.now() + 1000,
      });

      const receipt2: any = await tx2.wait();
      const tokenId2 = receipt2.events[receipt2.events.length - 1].args.tokenId;

      await NonFungiblePositionManager.setApprovalForAll(PositionManager.address, true);
      await PositionManager.depositUniNft(user.address, [tokenId, tokenId2]);

      let positionBeforeTrade = await NonFungiblePositionManager.positions(tokenId2);
      expect(positionBeforeTrade.tokensOwed0).to.be.equal(0);
      expect(positionBeforeTrade.tokensOwed1).to.be.equal(0);

      let sign;
      // Do some trades to accrue fees
      for (let i = 0; i < 20; i++) {
        // @ts-ignore
        sign = i % 2 == 0;
        await Router.connect(trader).swap(Pool0.address, sign, '0x' + (2e27).toString(16));
        //({ tick, sqrtPriceX96 } = await poolI.slot0());
      }

      await PositionManager.updateUncollectedFees(tokenId);
      await PositionManager.updateUncollectedFees(tokenId2);

      let positionAfterTrade = await NonFungiblePositionManager.positions(tokenId2);

      expect(positionAfterTrade.tokensOwed0).to.gt(0);
      expect(positionAfterTrade.tokensOwed1).to.gt(0);

      await AutoCompoundModule.collectFees(PositionManager.address, tokenEth.address, tokenUsdc.address);

      let position = await NonFungiblePositionManager.positions(tokenId2);

      expect(position.tokensOwed0).to.be.equal(0);
      expect(position.tokensOwed1).to.be.equal(0);
    });
  });
});
