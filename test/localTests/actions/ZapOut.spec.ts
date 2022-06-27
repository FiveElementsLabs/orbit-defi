import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { Contract, BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import {
  tokensFixture,
  poolFixture,
  mintSTDAmount,
  RegistryFixture,
  deployUniswapContracts,
  deployContract,
  deployPositionManagerFactoryAndActions,
  getPositionManager,
  doAllApprovals,
} from '../../shared/fixtures';
import { MockToken, IUniswapV3Pool, INonfungiblePositionManager, ZapOut, PositionManager } from '../../../typechain';

describe('ZapOut.sol', function () {
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
  let ZapOutFallback: ZapOut;
  let PositionManager: PositionManager;
  let registry: Contract;

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
    [Factory, NonFungiblePositionManager, SwapRouter] = await deployUniswapContracts(tokenEth);

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
      ['ZapOut']
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
      [liquidityProvider, user],
      [NonFungiblePositionManager.address, PositionManager.address],
      [tokenEth, tokenDai, tokenUsdc]
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
        fee: 3000,
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
        fee: 3000,
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

    ZapOutFallback = (await ethers.getContractAt('IZapOut', PositionManager.address)) as ZapOut;
  });

  describe('ZapOut.sol', function () {
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
        recipient: PositionManager.address,
        deadline: Date.now() + 1000,
      });
      const mintReceipt: any = await mintTx.wait();
      const tokenId = mintReceipt.events[mintReceipt.events.length - 1].args.tokenId.toNumber();
      const daiBalance = await tokenDai.balanceOf(user.address);

      await ZapOutFallback.connect(user).zapOut(tokenId, tokenDai.address);

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
        recipient: PositionManager.address,
        deadline: Date.now() + 1000,
      });
      const mintReceipt: any = await mintTx.wait();
      const tokenId = mintReceipt.events[mintReceipt.events.length - 1].args.tokenId.toNumber();
      const usdcBalance = await tokenUsdc.balanceOf(user.address);

      await ZapOutFallback.connect(user).zapOut(tokenId, tokenUsdc.address);

      await expect(NonFungiblePositionManager.ownerOf(tokenId)).to.be.reverted;
      expect(await tokenUsdc.balanceOf(user.address)).to.be.closeTo(
        usdcBalance.add(BigNumber.from(2e6)),
        BigNumber.from(1e6 * 0.01)
      );
    });

    it('should revert if user is not owner of position', async function () {
      expect(ZapOutFallback.connect(user).zapOut(1, tokenDai.address)).to.be.reverted;
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
        recipient: PositionManager.address,
        deadline: Date.now() + 1000,
      });
      const mintReceipt: any = await mintTx.wait();
      const tokenId = mintReceipt.events[mintReceipt.events.length - 1].args.tokenId.toNumber();
      expect(ZapOutFallback.connect(user).zapOut(tokenId, tokenUsdt.address)).to.be.reverted;
    });

    it('should fail to zap if twap deviation is too high', async function () {
      const mintTx = await NonFungiblePositionManager.connect(user).mint({
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 3000,
        tickLower: 0 - 60 * 1000,
        tickUpper: 0 + 60 * 1000,
        amount0Desired: '0x' + (1e13).toString(16),
        amount1Desired: '0x' + (1e14).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: PositionManager.address,
        deadline: Date.now() + 1000,
      });
      const mintReceipt: any = await mintTx.wait();
      const tokenId = mintReceipt.events[mintReceipt.events.length - 1].args.tokenId.toNumber();

      await registry.setMaxTwapDeviation(10);

      const tickBefore1 = (await PoolEthDai3000.slot0()).tick;
      const tickBefore2 = (await PoolUsdcDai3000.slot0()).tick;

      // This zap should succeed
      await ZapOutFallback.connect(user).zapOut(tokenId, tokenDai.address);

      const tickAfter1 = (await PoolEthDai3000.slot0()).tick;
      const tickAfter2 = (await PoolUsdcDai3000.slot0()).tick;

      expect(tickAfter1).to.not.be.eq(tickBefore1);
      expect(tickAfter2).to.not.be.eq(tickBefore2);

      const mintTx2 = await NonFungiblePositionManager.connect(user).mint({
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 3000,
        tickLower: 0 - 60 * 1000,
        tickUpper: 0 + 60 * 1000,
        amount0Desired: 1e9,
        amount1Desired: 1e9,
        amount0Min: 0,
        amount1Min: 0,
        recipient: PositionManager.address,
        deadline: Date.now() + 1000,
      });
      const mintReceipt2: any = await mintTx2.wait();
      const tokenId2 = mintReceipt2.events[mintReceipt2.events.length - 1].args.tokenId.toNumber();

      // This zap should fail because of maxTwapDeviation
      await expect(ZapOutFallback.connect(user).zapOut(tokenId2, tokenDai.address)).to.be.revertedWith(
        'SwapHelper::checkDeviation: Price deviation is too high'
      );
    });

    it('should correctly exit a position for nonzero tick of a pool', async function () {
      //make some trades to change the tick of the pool
      let poolTick = Math.round((await PoolEthUsdc500.slot0())[1] / 10) * 10;
      const swapAmount = '0x' + (1e14).toString(16);
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
      await PositionManager.withdrawERC20(tokenEth.address);
      await PositionManager.withdrawERC20(tokenUsdc.address);
      const beforeLength = await PositionManager.getAllUniPositions();
      const mintTx = await NonFungiblePositionManager.connect(user).mint({
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 500,
        tickLower: poolTick - 600,
        tickUpper: poolTick + 600,
        amount0Desired: '0x' + (1e13).toString(16),
        amount1Desired: '0x' + (1e14).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: PositionManager.address,
        deadline: Date.now() + 1000,
      });
      const mintReceipt: any = await mintTx.wait();
      const tokenId = mintReceipt.events[mintReceipt.events.length - 1].args.tokenId.toNumber();
      await ZapOutFallback.connect(user).zapOut(tokenId, tokenEth.address);
      const afterLength = await PositionManager.getAllUniPositions();
      expect(Number(afterLength.length)).to.equal(Number(beforeLength.length));
      await expect(NonFungiblePositionManager.positions(tokenId)).to.be.reverted;
    });
  });
});
