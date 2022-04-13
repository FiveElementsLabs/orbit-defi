import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ContractFactory, Contract } from 'ethers';
import { ethers } from 'hardhat';
const hre = require('hardhat');
const UniswapV3Factoryjson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');
const NonFungiblePositionManagerjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');
const NonFungiblePositionManagerDescriptorjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json');
const SwapRouterjson = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json');
const FixturesConst = require('../shared/fixtures');
import { tokensFixture, poolFixture, mintSTDAmount } from '../shared/fixtures';
import { MockToken, IUniswapV3Pool, INonfungiblePositionManager, Zapper } from '../../typechain';

describe('Zapper.sol', function () {
  //GLOBAL VARIABLE - USE THIS
  let user: any = ethers.getSigners().then(async (signers) => {
    return signers[0];
  });
  let liquidityProvider: any = ethers.getSigners().then(async (signers) => {
    return signers[1];
  });

  //all the token used globally
  let tokenEth: MockToken, tokenUsdc: MockToken, tokenDai: MockToken, tokenUsdt: MockToken;

  //all the pools used globally
  let PoolEthUsdc3000: IUniswapV3Pool, PoolEthDai3000: IUniswapV3Pool, PoolUsdcDai3000: IUniswapV3Pool;
  let PoolEthUsdc500: IUniswapV3Pool, PoolEthDai500: IUniswapV3Pool, PoolUsdcDai500: IUniswapV3Pool;

  let Factory: Contract; // the factory that will deploy all pools
  let NonFungiblePositionManager: INonfungiblePositionManager; // NonFungiblePositionManager contract by UniswapV3
  let SwapRouter: Contract;
  let zapper: Zapper;

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    user = await user; //owner of the smart vault, a normal user
    liquidityProvider = await liquidityProvider; //generic address as other users, mint pool liquidity, try to do onlyUser call etc

    //deploy first 3 token - ETH, USDC, DAI
    tokenEth = (await tokensFixture('ETH', 18)).tokenFixture;
    tokenDai = (await tokensFixture('DAI', 18)).tokenFixture;
    tokenUsdc = (await tokensFixture('USDC', 6)).tokenFixture;
    tokenUsdt = (await tokensFixture('USDT', 18)).tokenFixture;

    //deploy factory, used for pools
    const uniswapFactoryFactory = new ContractFactory(
      UniswapV3Factoryjson['abi'],
      UniswapV3Factoryjson['bytecode'],
      user
    );
    Factory = await uniswapFactoryFactory.deploy();
    await Factory.deployed();

    //deploy some pools
    PoolEthUsdc3000 = (await poolFixture(tokenEth, tokenUsdc, 3000, Factory)).pool;
    PoolEthDai3000 = (await poolFixture(tokenEth, tokenDai, 3000, Factory)).pool;
    PoolUsdcDai3000 = (await poolFixture(tokenDai, tokenUsdc, 3000, Factory)).pool;
    PoolEthUsdc500 = (await poolFixture(tokenEth, tokenUsdc, 500, Factory)).pool;
    PoolEthDai500 = (await poolFixture(tokenEth, tokenDai, 500, Factory)).pool;
    PoolUsdcDai500 = (await poolFixture(tokenDai, tokenUsdc, 500, Factory)).pool;

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
    );
    await NonFungiblePositionManagerDescriptor.deployed();

    const NonFungiblePositionManagerFactory = new ContractFactory(
      NonFungiblePositionManagerjson['abi'],
      NonFungiblePositionManagerjson['bytecode'],
      user
    );
    NonFungiblePositionManager = (await NonFungiblePositionManagerFactory.deploy(
      Factory.address,
      tokenEth.address,
      NonFungiblePositionManagerDescriptor.address
    )) as INonfungiblePositionManager;
    await NonFungiblePositionManager.deployed();

    //deploy router
    const SwapRouterFactory = new ContractFactory(SwapRouterjson['abi'], SwapRouterjson['bytecode'], user);
    SwapRouter = await SwapRouterFactory.deploy(Factory.address, tokenEth.address);
    await SwapRouter.deployed();

    //deploy uniswapAddressHolder
    const uniswapAddressHolderFactory = await ethers.getContractFactory('UniswapAddressHolder');
    const uniswapAddressHolder = await uniswapAddressHolderFactory.deploy(
      NonFungiblePositionManager.address,
      Factory.address,
      SwapRouter.address
    );
    await uniswapAddressHolder.deployed();

    //deploy zapper contract
    const zapperFactory = await ethers.getContractFactory('Zapper');
    zapper = (await zapperFactory.deploy(uniswapAddressHolder.address)) as Zapper;
    await zapper.deployed();

    //APPROVE

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
    //recipient: zapper - spender: user
    await tokenEth.connect(user).approve(zapper.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc.connect(user).approve(zapper.address, ethers.utils.parseEther('100000000000000'));

    // give pools some liquidity
    await NonFungiblePositionManager.connect(liquidityProvider).mint(
      {
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 3000,
        tickLower: 0 - 60 * 1000,
        tickUpper: 0 + 60 * 1000,
        amount0Desired: '0x' + (1e10).toString(16),
        amount1Desired: '0x' + (1e10).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: liquidityProvider.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );

    await NonFungiblePositionManager.connect(liquidityProvider).mint(
      {
        token0: tokenEth.address,
        token1: tokenDai.address,
        fee: 3000,
        tickLower: 0 - 60 * 1000,
        tickUpper: 0 + 60 * 1000,
        amount0Desired: '0x' + (1e10).toString(16),
        amount1Desired: '0x' + (1e10).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: liquidityProvider.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );

    await NonFungiblePositionManager.connect(liquidityProvider).mint(
      {
        token0: tokenUsdc.address,
        token1: tokenDai.address,
        fee: 3000,
        tickLower: 0 - 60 * 1000,
        tickUpper: 0 + 60 * 1000,
        amount0Desired: '0x' + (1e10).toString(16),
        amount1Desired: '0x' + (1e10).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: liquidityProvider.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );

    await NonFungiblePositionManager.connect(liquidityProvider).mint(
      {
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 500,
        tickLower: 0 - 60 * 1000,
        tickUpper: 0 + 60 * 1000,
        amount0Desired: '0x' + (1e15).toString(16),
        amount1Desired: '0x' + (1e15).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: liquidityProvider.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );

    await NonFungiblePositionManager.connect(liquidityProvider).mint(
      {
        token0: tokenEth.address,
        token1: tokenDai.address,
        fee: 500,
        tickLower: 0 - 60 * 1000,
        tickUpper: 0 + 60 * 1000,
        amount0Desired: '0x' + (1e15).toString(16),
        amount1Desired: '0x' + (1e15).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: liquidityProvider.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );

    await NonFungiblePositionManager.connect(liquidityProvider).mint(
      {
        token0: tokenUsdc.address,
        token1: tokenDai.address,
        fee: 500,
        tickLower: 0 - 60 * 1000,
        tickUpper: 0 + 60 * 1000,
        amount0Desired: '0x' + (1e15).toString(16),
        amount1Desired: '0x' + (1e15).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: liquidityProvider.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );
  });

  describe('Zapper.zapIn()', function () {
    it('should correctly mint a position', async function () {
      const amountIn = 1e8;
      const fee = 3000;
      const tickLower = 0 - 60 * 1000;
      const tickUpper = 0 + 60 * 1000;
      const zapInTx = await zapper
        .connect(user)
        .zapIn(tokenEth.address, amountIn, tokenDai.address, tokenUsdc.address, tickLower, tickUpper, fee);

      const events: any = (await zapInTx.wait()).events;
      const tokenId = await events[events.length - 1].args.tokenId.toNumber();

      expect(user.address).to.be.equal(await NonFungiblePositionManager.ownerOf(tokenId));

      const position = await NonFungiblePositionManager.positions(tokenId);

      expect(position.token0).to.be.equal(tokenUsdc.address);
      expect(position.token1).to.be.equal(tokenDai.address);
      expect(position.fee).to.be.equal(fee);
      expect(position.tickLower).to.be.equal(tickLower);
      expect(position.tickUpper).to.be.equal(tickUpper);
      expect(position.liquidity).to.gt(0);
    });

    it('should correclty zap in if one of the two tokens is tokenIn', async function () {
      const amountIn = 1e8;
      const fee = 3000;
      const tickLower = 0 - 60 * 1000;
      const tickUpper = 0 + 60 * 1000;
      const zapInTx = await zapper
        .connect(user)
        .zapIn(tokenEth.address, amountIn, tokenEth.address, tokenUsdc.address, tickLower, tickUpper, fee);

      const events: any = (await zapInTx.wait()).events;
      const tokenId = await events[events.length - 1].args.tokenId.toNumber();

      expect(user.address).to.be.equal(await NonFungiblePositionManager.ownerOf(tokenId));

      const position = await NonFungiblePositionManager.positions(tokenId);

      expect(position.token0).to.be.equal(tokenEth.address);
      expect(position.token1).to.be.equal(tokenUsdc.address);
      expect(position.fee).to.be.equal(fee);
      expect(position.tickLower).to.be.equal(tickLower);
      expect(position.tickUpper).to.be.equal(tickUpper);
      expect(position.liquidity).to.gt(0);
    });

    it('should revert if pool does not exist', async function () {
      const amountIn = 1e8;
      const fee = 100;
      const tickLower = 0 - 60 * 1000;
      const tickUpper = 0 + 60 * 1000;
      await expect(
        zapper
          .connect(user)
          .zapIn(tokenEth.address, amountIn, tokenEth.address, tokenUsdc.address, tickLower, tickUpper, fee)
      ).to.be.reverted;
    });
  });

  describe('Zapper.zapOut()', function () {
    it('should correctly exit a position', async function () {
      await tokenEth
        .connect(user)
        .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
      await tokenUsdc
        .connect(user)
        .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
      const mintTx = await NonFungiblePositionManager.connect(user).mint({
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 3000,
        tickLower: 0 - 60 * 1000,
        tickUpper: 0 + 60 * 1000,
        amount0Desired: 1e6,
        amount1Desired: 1e6,
        amount0Min: 0,
        amount1Min: 0,
        recipient: user.address,
        deadline: Date.now() + 1000,
      });
      const mintReceipt: any = await mintTx.wait();
      const tokenId = mintReceipt.events[mintReceipt.events.length - 1].args.tokenId.toNumber();
      const daiBalance = await tokenDai.balanceOf(user.address);
      await NonFungiblePositionManager.connect(user).setApprovalForAll(zapper.address, true);

      await zapper.connect(user).zapOut(tokenId, tokenDai.address);

      await expect(NonFungiblePositionManager.ownerOf(tokenId)).to.be.reverted;
      expect(await tokenDai.balanceOf(user.address)).to.be.gt(daiBalance);
    });

    it('should correctly exit a position even if tokenOut is one of the two tokens', async function () {
      await tokenEth
        .connect(user)
        .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
      await tokenUsdc
        .connect(user)
        .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
      const mintTx = await NonFungiblePositionManager.connect(user).mint({
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 3000,
        tickLower: 0 - 60 * 1000,
        tickUpper: 0 + 60 * 1000,
        amount0Desired: 1e6,
        amount1Desired: 1e6,
        amount0Min: 0,
        amount1Min: 0,
        recipient: user.address,
        deadline: Date.now() + 1000,
      });
      const mintReceipt: any = await mintTx.wait();
      const tokenId = mintReceipt.events[mintReceipt.events.length - 1].args.tokenId.toNumber();
      const usdcBalance = await tokenUsdc.balanceOf(user.address);
      await NonFungiblePositionManager.connect(user).setApprovalForAll(zapper.address, true);

      await zapper.connect(user).zapOut(tokenId, tokenUsdc.address);

      await expect(NonFungiblePositionManager.ownerOf(tokenId)).to.be.reverted;
      expect(await tokenUsdc.balanceOf(user.address)).to.be.gt(usdcBalance);
    });

    it('should revert if user is not owner of position', async function () {
      expect(zapper.connect(user).zapOut(1, tokenDai.address)).to.be.reverted;
    });

    it('should revert if pool does not exist', async function () {
      await tokenEth
        .connect(user)
        .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
      await tokenUsdc
        .connect(user)
        .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
      const mintTx = await NonFungiblePositionManager.connect(user).mint({
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 3000,
        tickLower: 0 - 60 * 1000,
        tickUpper: 0 + 60 * 1000,
        amount0Desired: 1e6,
        amount1Desired: 1e6,
        amount0Min: 0,
        amount1Min: 0,
        recipient: user.address,
        deadline: Date.now() + 1000,
      });
      const mintReceipt: any = await mintTx.wait();
      const tokenId = mintReceipt.events[mintReceipt.events.length - 1].args.tokenId.toNumber();
      expect(zapper.connect(user).zapOut(tokenId, tokenUsdt.address)).to.be.reverted;
    });
  });
});