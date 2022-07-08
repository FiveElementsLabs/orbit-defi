import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { AbiCoder } from 'ethers/lib/utils';
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
import { MockToken, IUniswapV3Pool, INonfungiblePositionManager, PositionManager } from '../../../typechain';
import UniswapV3Pool from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json';

describe('SwapToPositionRatio.sol', function () {
  //GLOBAL VARIABLE - USE THIS
  let user: any = ethers.getSigners().then(async (signers) => {
    return signers[0];
  });
  let liquidityProvider: any = ethers.getSigners().then(async (signers) => {
    return signers[1];
  });

  //all the token used globally
  let tokenEth: MockToken, tokenUsdc: MockToken, tokenDai: MockToken;

  //all the pools used globally
  let Pool0: IUniswapV3Pool;

  let Factory: Contract; // the factory that will deploy all pools
  let NonFungiblePositionManager: INonfungiblePositionManager; // NonFungiblePositionManager contract by UniswapV3
  let PositionManager: PositionManager; // PositionManager contract by UniswapV3
  let SwapRouter: Contract; // SwapRouter contract by UniswapV3
  let SwapToPositionRatioFallback: Contract; // SwapToPositionRatio contract
  let abiCoder: AbiCoder;
  let UniswapAddressHolder: Contract; // address holder for UniswapV3 contracts
  let registry: Contract;

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    user = await user; //owner of the smart vault, a normal user
    liquidityProvider = await liquidityProvider;

    //deploy first 3 tokens - ETH, USDC, DAI
    tokenEth = (await tokensFixture('ETH', 18)).tokenFixture;
    tokenUsdc = (await tokensFixture('USDC', 6)).tokenFixture;
    tokenDai = (await tokensFixture('DAI', 18)).tokenFixture;

    //deploy factory, used for pools
    [Factory, NonFungiblePositionManager, SwapRouter] = await deployUniswapContracts(tokenEth);

    //deploy first pool
    Pool0 = (await poolFixture(tokenEth, tokenUsdc, 3000, Factory, 0)).pool;

    //mint 1e30 token, you can call with arbitrary amount
    await mintSTDAmount(tokenEth);
    await mintSTDAmount(tokenUsdc);
    await mintSTDAmount(tokenDai);

    //deploy our contracts
    registry = (await RegistryFixture(user.address)).registryFixture;
    const UniswapAddressHolder = await deployContract('UniswapAddressHolder', [
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
      UniswapAddressHolder.address,
      '0x0000000000000000000000000000000000000000',
      ['SwapToPositionRatio']
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

    //get AbiCoder
    abiCoder = ethers.utils.defaultAbiCoder;

    //APPROVE
    await doAllApprovals(
      [user, liquidityProvider],
      [PositionManager.address, NonFungiblePositionManager.address],
      [tokenEth, tokenUsdc]
    );

    //give PositionManager some tokens
    await tokenEth.connect(user).transfer(PositionManager.address, ethers.utils.parseEther('1000000000000'));
    await tokenUsdc.connect(user).transfer(PositionManager.address, ethers.utils.parseEther('1000000000000'));

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

    SwapToPositionRatioFallback = (await ethers.getContractAt(
      'ISwapToPositionRatio',
      PositionManager.address
    )) as Contract;
  });

  describe('doAction', function () {
    it('should correctly swap to exact position ratio amount0In', async function () {
      const tickLower = -600;
      const tickUpper = 600;
      const amount0In = 1e5;
      const amount1In = 2e5;

      await SwapToPositionRatioFallback.connect(user).swapToPositionRatioV2({
        token0Address: tokenEth.address,
        token1Address: tokenUsdc.address,
        fee: 3000,
        amount0In: amount0In,
        amount1In: amount1In,
        tickLower: tickLower,
        tickUpper: tickUpper,
      });
    });

    it('should correctly swap to exact position ratio amount1In', async function () {
      const tickLower = -600;
      const tickUpper = 300;
      const amount0In = 2e5;
      const amount1In = 1e5;

      await SwapToPositionRatioFallback.connect(user).swapToPositionRatioV2({
        token0Address: tokenEth.address,
        token1Address: tokenUsdc.address,
        fee: 3000,
        amount0In: amount0In,
        amount1In: amount1In,
        tickLower: tickLower,
        tickUpper: tickUpper,
      });
    });

    it('should correctly return output', async function () {
      const tickLower = -300;
      const tickUpper = 600;
      const amount0In = 1e5;
      const amount1In = 2e5;

      const tx = await SwapToPositionRatioFallback.connect(user).swapToPositionRatioV2({
        token0Address: tokenEth.address,
        token1Address: tokenUsdc.address,
        fee: 3000,
        amount0In: amount0In,
        amount1In: amount1In,
        tickLower: tickLower,
        tickUpper: tickUpper,
      });

      const events = (await tx.wait()).events as any;
      const outputEvent = events[events.length - 1];
      const [, , amount0Out, amount1Out] = abiCoder.decode(
        ['address', 'address', 'uint256', 'uint256'],
        outputEvent.data
      );
      expect(amount0Out.toNumber()).to.equal(199202);
      expect(amount1Out.toNumber()).to.equal(100498);
    });

    it('should fail to swap if twap deviation is too high', async function () {
      // 0. change maxTwapDeviation to a small value (10)
      // 1. make a big swap to change ticks by at least maxTwapDeviation
      // 2. check tick has changed after swap
      // 3. try to swap again and check that it fails for max twap deviation

      await registry.setMaxTwapDeviation(10);
      const tickBefore = (await Pool0.slot0()).tick;

      // This swap should succeed
      const tickLower = -800;
      const tickUpper = 200;
      let amount0In = '0x' + (1e24).toString(16);
      let amount1In = '0x' + (1e24).toString(16);

      await SwapToPositionRatioFallback.connect(user).swapToPositionRatioV2({
        token0Address: tokenEth.address,
        token1Address: tokenUsdc.address,
        fee: 3000,
        amount0In: amount0In,
        amount1In: amount1In,
        tickLower: tickLower,
        tickUpper: tickUpper,
      });

      const tickAfter = (await Pool0.slot0()).tick;
      expect(tickAfter).to.not.be.eq(tickBefore);

      // This swap should fail because of maxTwapDeviation
      amount0In = '0x' + (1e20).toString(16);
      amount1In = '0x' + (1e18).toString(16);
      await expect(
        SwapToPositionRatioFallback.connect(user).swapToPositionRatioV2({
          token0Address: tokenEth.address,
          token1Address: tokenUsdc.address,
          fee: 3000,
          amount0In: amount0In,
          amount1In: amount1In,
          tickLower: tickLower,
          tickUpper: tickUpper,
        })
      ).to.be.revertedWith('SwapHelper::checkDeviation: Price deviation is too high');
    });

    it('should revert if pool does not exist', async function () {
      const tickLower = -720;
      const tickUpper = 720;
      const amount0In = 7e5;
      const amount1In = 5e5;

      await expect(
        SwapToPositionRatioFallback.connect(user).swapToPositionRatioV2({
          token0Address: tokenEth.address,
          token1Address: tokenDai.address,
          fee: 2345,
          amount0In: amount0In,
          amount1In: amount1In,
          tickLower: tickLower,
          tickUpper: tickUpper,
        })
      ).to.be.reverted;
    });

    it('should swap for positive pool ticks', async function () {
      //create pool with negative tick
      const tx = await Factory.createPool(tokenEth.address, tokenUsdc.address, 500);
      const receipt = (await tx.wait()) as any;
      const poolEthUsdc500 = new ethers.Contract(
        receipt.events[0].args.pool,
        UniswapV3Pool['abi'],
        user
      ) as IUniswapV3Pool;

      let startTick = 12300;
      const price = Math.pow(1.0001, startTick);
      await poolEthUsdc500.initialize('0x' + (Math.sqrt(price) * Math.pow(2, 96)).toString(16));
      await poolEthUsdc500.increaseObservationCardinalityNext(100);

      //mint a position in this pool
      await NonFungiblePositionManager.connect(liquidityProvider).mint(
        {
          token0: tokenEth.address,
          token1: tokenUsdc.address,
          fee: 500,
          tickLower: 0 - 60 * 24,
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
      await poolEthUsdc500.increaseObservationCardinalityNext(1);

      //call swap to position ratio
      const tickLower = 60;
      const tickUpper = 60 * 200;
      const amount0In = 1e5;
      const amount1In = 2e5;

      await SwapToPositionRatioFallback.connect(user).swapToPositionRatioV2({
        token0Address: tokenEth.address,
        token1Address: tokenUsdc.address,
        fee: 500,
        amount0In: amount0In,
        amount1In: amount1In,
        tickLower: tickLower,
        tickUpper: tickUpper,
      });
    });

    it('should swap for negative pool ticks', async function () {
      //create pool with negative tick
      const tx = await Factory.createPool(tokenEth.address, tokenUsdc.address, 10000);
      const receipt = (await tx.wait()) as any;

      const poolEthUsdc10000 = new ethers.Contract(
        receipt.events[0].args.pool,
        UniswapV3Pool['abi'],
        user
      ) as IUniswapV3Pool;

      let startTick = -500;
      const price = Math.pow(1.0001, startTick);
      await poolEthUsdc10000.initialize('0x' + (Math.sqrt(price) * Math.pow(2, 96)).toString(16));
      await poolEthUsdc10000.increaseObservationCardinalityNext(100);

      //mint a position in this pool
      await NonFungiblePositionManager.connect(liquidityProvider).mint(
        {
          token0: tokenEth.address,
          token1: tokenUsdc.address,
          fee: 10000,
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
      await poolEthUsdc10000.increaseObservationCardinalityNext(1);

      //call swap to position ratio
      const tickLower = -800;
      const tickUpper = 600;
      const amount0In = 1e5;
      const amount1In = 2e5;

      await SwapToPositionRatioFallback.connect(user).swapToPositionRatioV2({
        token0Address: tokenEth.address,
        token1Address: tokenUsdc.address,
        fee: 10000,
        amount0In: amount0In,
        amount1In: amount1In,
        tickLower: tickLower,
        tickUpper: tickUpper,
      });
    });
  });
});
