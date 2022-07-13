import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { BigNumber, Contract } from 'ethers';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import {
  tokensFixture,
  poolFixture,
  mintSTDAmount,
  deployUniswapContracts,
  deployContract,
  deployPositionManagerFactoryAndActions,
  getPositionManager,
  doAllApprovals,
  RegistryFixture,
} from '../../shared/fixtures';
import {
  MockToken,
  IUniswapV3Pool,
  INonfungiblePositionManager,
  ZapIn,
  PositionManager,
  Swap,
} from '../../../typechain';

describe('ZapIn.sol', function () {
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
  let PoolUsdtUsdc500: IUniswapV3Pool;

  let Factory: Contract; // the factory that will deploy all pools
  let NonFungiblePositionManager: INonfungiblePositionManager; // NonFungiblePositionManager contract by UniswapV3
  let SwapRouter: Contract; // SwapRouter contract by UniswapV3
  let ZapInFallback: ZapIn;
  let PositionManager: PositionManager;
  let registry: Contract;

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    user = await user; //owner of the smart vault, a normal user
    liquidityProvider = await liquidityProvider; //generic address as other users, mint pool liquidity, try to do onlyUser call etc

    //deploy first 4 tokens - ETH, USDC, DAI, USDT
    tokenEth = (await tokensFixture('ETH', 18)).tokenFixture;
    tokenDai = (await tokensFixture('DAI', 18)).tokenFixture;
    tokenUsdc = (await tokensFixture('USDC', 6)).tokenFixture;
    tokenUsdt = (await tokensFixture('USDT', 12)).tokenFixture;

    //deploy factory, used for pools
    [Factory, NonFungiblePositionManager, SwapRouter] = await deployUniswapContracts(tokenEth);

    //deploy some pools
    PoolEthUsdc3000 = (await poolFixture(tokenEth, tokenUsdc, 3000, Factory, 0)).pool;
    PoolEthDai3000 = (await poolFixture(tokenEth, tokenDai, 3000, Factory, 0)).pool;
    PoolUsdcDai3000 = (await poolFixture(tokenDai, tokenUsdc, 3000, Factory, 0)).pool;
    PoolEthUsdc500 = (await poolFixture(tokenEth, tokenUsdc, 500, Factory, 0)).pool;
    PoolEthDai500 = (await poolFixture(tokenEth, tokenDai, 500, Factory, 0)).pool;
    PoolUsdcDai500 = (await poolFixture(tokenDai, tokenUsdc, 500, Factory, 0)).pool;
    PoolUsdtUsdc500 = (await poolFixture(tokenUsdt, tokenUsdc, 500, Factory, 0)).pool;

    //mint 1e30 token, you can call with arbitrary amount
    await mintSTDAmount(tokenEth);
    await mintSTDAmount(tokenUsdc);
    await mintSTDAmount(tokenDai);
    await mintSTDAmount(tokenUsdt);

    //deploy our contracts
    registry = (await RegistryFixture(user.address)).registryFixture;
    const uniswapAddressHolder = await deployContract('UniswapAddressHolder', [
      NonFungiblePositionManager.address,
      Factory.address,
      SwapRouter.address,
      registry.address,
    ]);
    const diamondCutFacet = await deployContract('DiamondCutFacet');

    //deploy the PositionManagerFactory => deploy PositionManager
    const PositionManagerFactory = await deployPositionManagerFactoryAndActions(
      user.address,
      registry.address,
      diamondCutFacet.address,
      uniswapAddressHolder.address,
      '0x0000000000000000000000000000000000000000',
      ['ZapIn']
    );

    await registry.setPositionManagerFactory(PositionManagerFactory.address);
    await registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Test')),
      user.address,
      hre.ethers.utils.formatBytes32String('1'),
      true
    );
    await registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Factory')),
      PositionManagerFactory.address,
      hre.ethers.utils.formatBytes32String('1'),
      true
    );

    PositionManager = (await getPositionManager(PositionManagerFactory, user)) as PositionManager;

    //APPROVE
    await doAllApprovals(
      [user, liquidityProvider],
      [NonFungiblePositionManager.address, PositionManager.address],
      [tokenDai, tokenEth, tokenUsdc]
    );

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
        amount0Desired: '0x' + (1e25).toString(16),
        amount1Desired: '0x' + (1e25).toString(16),
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

    ZapInFallback = (await ethers.getContractAt('IZapIn', PositionManager.address)) as ZapIn;
  });

  describe('ZapIn.sol', function () {
    it('should correctly mint a position', async function () {
      const beforeLength = await PositionManager.getAllUniPositions();
      const poolTick = Math.round((await PoolUsdcDai500.slot0())[1] / 10) * 10;

      await ZapInFallback.connect(user).zapIn(
        tokenUsdc.address,
        tokenDai.address,
        true,
        1000,
        poolTick - 600,
        poolTick + 600,
        500
      );
      const afterLength = await PositionManager.getAllUniPositions();
      expect(Number(afterLength)).to.be.gt(Number(beforeLength));
    });

    it('should mint a position with tokens with different decimals', async function () {
      const beforeLength = await PositionManager.getAllUniPositions();
      await ZapInFallback.connect(user).zapIn(
        tokenEth.address,
        tokenUsdc.address,
        false,
        1000000000000,
        -600,
        600,
        500
      );
      const afterLength = await PositionManager.getAllUniPositions();
      expect(Number(afterLength[1])).to.be.gt(Number(beforeLength));
    });

    it('should mint out of range', async function () {
      const beforeLength = await PositionManager.getAllUniPositions();
      await PositionManager.withdrawERC20(tokenEth.address);
      await PositionManager.withdrawERC20(tokenUsdc.address);
      await ZapInFallback.connect(user).zapIn(tokenEth.address, tokenUsdc.address, false, 10000, 400, 500, 500);
      const afterLength = await PositionManager.getAllUniPositions();
      expect(Number(afterLength.length)).to.be.gt(Number(beforeLength.length));
    });

    it('should fail if amountIn is 0', async function () {
      await expect(
        ZapInFallback.connect(user).zapIn(tokenUsdc.address, tokenDai.address, false, 0, -600, 600, 500)
      ).to.be.revertedWith('ZapIn::zapIn: tokenIn cannot be 0');
    });

    it('should fail to zap if twap deviation is too high', async function () {
      // 0. change maxTwapDeviation to a small value (10)
      // 1. make a big swap to change ticks by at least maxTwapDeviation
      // 2. check tick has changed after swap
      // 3. try to swap again and check that it fails for max twap deviation

      await registry.setMaxTwapDeviation(10);
      const tickBefore = (await PoolEthUsdc500.slot0()).tick;

      // This zap should succeed
      await ZapInFallback.connect(user).zapIn(
        tokenEth.address,
        tokenUsdc.address,
        false,
        '0x' + (1e23).toString(16),
        -600,
        600,
        500
      );

      const tickAfter = (await PoolEthUsdc500.slot0()).tick;
      expect(tickAfter).to.not.be.eq(tickBefore);

      // This zap should fail because of maxTwapDeviation
      await expect(
        ZapInFallback.connect(user).zapIn(
          tokenEth.address,
          tokenUsdc.address,
          false,
          '0x' + (1e21).toString(16),
          -600,
          600,
          500
        )
      ).to.be.revertedWith('SwapHelper::checkDeviation: Price deviation is too high');
    });

    it('should mint for any tick of the pool', async function () {
      //make some trades to change the tick of the pool
      let poolTick = Math.round((await PoolEthUsdc500.slot0())[1] / 10) * 10;
      const swapAmount = '0x' + (1e25).toString(16);
      while (poolTick > -500 && poolTick < 500) {
        tokenEth.connect(liquidityProvider).approve(SwapRouter.address, swapAmount);
        await SwapRouter.connect(liquidityProvider).exactInputSingle([
          tokenEth.address,
          tokenUsdc.address,
          500,
          liquidityProvider.address,
          Date.now() + 1000,
          swapAmount,
          0,
          0,
        ]);
        poolTick = Math.round((await PoolEthUsdc500.slot0())[1] / 10) * 10;
      }
      await registry.setMaxTwapDeviation(2 ** 23 - 1);
      const beforeLength = await PositionManager.getAllUniPositions();
      const amount = 1e6;
      await PositionManager.withdrawERC20(tokenEth.address);
      await PositionManager.withdrawERC20(tokenUsdc.address);
      await ZapInFallback.connect(user).zapIn(
        tokenEth.address,
        tokenUsdc.address,
        false,
        amount,
        poolTick - 600,
        poolTick + 600,
        500
      );
      const afterLength = await PositionManager.getAllUniPositions();
      expect(Number(afterLength.length)).to.be.gt(Number(beforeLength.length));
      expect(await tokenEth.balanceOf(PositionManager.address)).to.be.closeTo(
        BigNumber.from(0),
        BigNumber.from((amount * 1e12) / 500)
      );
      expect(await tokenUsdc.balanceOf(PositionManager.address)).to.be.closeTo(
        BigNumber.from(0),
        BigNumber.from(amount / 500)
      );
    });
  });
});
