import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ContractFactory, Contract } from 'ethers';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import {
  tokensFixture,
  poolFixture,
  mintSTDAmount,
  deployUniswapContracts,
  deployContract,
  doAllApprovals,
  deployPositionManagerFactoryAndActions,
  getPositionManager,
} from '../../shared/fixtures';
import { MockToken, IUniswapV3Pool, INonfungiblePositionManager, DepositRecipes } from '../../../typechain';

describe('DepositRecipes.sol', function () {
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
  let DepositRecipes: DepositRecipes;
  let PositionManagerFactory: Contract;
  let PositionManagerFactoryFactory: ContractFactory;
  let DiamondCutFacet: Contract;
  let UniswapAddressHolder: Contract;
  let registry: Contract;
  let MintAction: Contract; // MintAction contract
  let ZapInAction: Contract; // ZapInAction contract
  let PositionManager: Contract;
  let abiCoder: any;
  let AutoCompoundModule: Contract;

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
    UniswapAddressHolder = await deployContract('UniswapAddressHolder', [
      NonFungiblePositionManager.address,
      Factory.address,
      SwapRouter.address,
    ]);
    DiamondCutFacet = await deployContract('DiamondCutFacet');
    registry = await deployContract('Registry', [user.address]);

    //deploy the PositionManagerFactory => deploy PositionManager
    PositionManagerFactory = await deployPositionManagerFactoryAndActions(
      user.address,
      registry.address,
      DiamondCutFacet.address,
      UniswapAddressHolder.address,
      '0x754386E5abd9f4ab41E68788b7eC402Ec527f06e',
      ['Mint', 'ZapIn']
    );

    abiCoder = ethers.utils.defaultAbiCoder;

    await registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('PositionManagerFactory')),
      PositionManagerFactory.address,
      abiCoder.encode(['uint256'], [1]),
      true
    );
    await registry.setPositionManagerFactory(PositionManagerFactory.address);

    PositionManager = await getPositionManager(PositionManagerFactory, user);

    //deploy DepositRecipes contract
    DepositRecipes = (await deployContract('DepositRecipes', [
      UniswapAddressHolder.address,
      PositionManagerFactory.address,
    ])) as DepositRecipes;
    AutoCompoundModule = await deployContract('AutoCompoundModule', [UniswapAddressHolder.address]);

    await registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('DepositRecipes')),
      DepositRecipes.address,
      abiCoder.encode(['uint256'], [1]),
      true
    );

    await registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Test')),
      user.address,
      abiCoder.encode(['uint256'], [1]),
      true
    );

    await registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('AutoCompoundModule')),
      AutoCompoundModule.address,
      abiCoder.encode(['uint256'], [5]),
      true
    );

    await doAllApprovals([user], [DepositRecipes.address, PositionManager.address], [tokenDai, tokenEth, tokenUsdc]);

    await NonFungiblePositionManager.setApprovalForAll(DepositRecipes.address, true);
    await NonFungiblePositionManager.setApprovalForAll(PositionManager.address, true);

    //APPROVE
    await doAllApprovals(
      [liquidityProvider, user],
      [NonFungiblePositionManager.address],
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

  describe('DepositRecipes.depositUniNFT()', function () {
    it('should deposit a token and update positions array', async function () {
      const mintTx = await NonFungiblePositionManager.connect(user).mint(
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
          recipient: user.address,
          deadline: Date.now() + 1000,
        },
        { gasLimit: 670000 }
      );

      const events: any = (await mintTx.wait()).events;
      const tokenId = await events[events.length - 1].args.tokenId.toNumber();

      await DepositRecipes.connect(user).depositUniNft([tokenId]);

      expect(await NonFungiblePositionManager.ownerOf(tokenId)).to.equal(PositionManager.address);
      expect((await PositionManager.getAllUniPositions())[0]).to.equal(tokenId);
    });

    it('should deposit multiple tokens and update positions array', async function () {
      let mintTx = await NonFungiblePositionManager.connect(user).mint(
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
          recipient: user.address,
          deadline: Date.now() + 1000,
        },
        { gasLimit: 670000 }
      );

      let events: any = (await mintTx.wait()).events;
      const tokenId1 = await events[events.length - 1].args.tokenId.toNumber();

      mintTx = await NonFungiblePositionManager.connect(user).mint(
        {
          token0: tokenUsdc.address,
          token1: tokenDai.address,
          fee: 3000,
          tickLower: 0 - 60 * 23,
          tickUpper: 0 + 60 * 57,
          amount0Desired: '0x' + (1e15).toString(16),
          amount1Desired: '0x' + (1e15).toString(16),
          amount0Min: 0,
          amount1Min: 0,
          recipient: user.address,
          deadline: Date.now() + 1000,
        },
        { gasLimit: 670000 }
      );

      events = (await mintTx.wait()).events;
      const tokenId2 = await events[events.length - 1].args.tokenId.toNumber();

      mintTx = await NonFungiblePositionManager.connect(user).mint(
        {
          token0: tokenUsdc.address,
          token1: tokenDai.address,
          fee: 3000,
          tickLower: 0 - 60 * 173,
          tickUpper: 0 + 60 * 482,
          amount0Desired: '0x' + (1e15).toString(16),
          amount1Desired: '0x' + (1e15).toString(16),
          amount0Min: 0,
          amount1Min: 0,
          recipient: user.address,
          deadline: Date.now() + 1000,
        },
        { gasLimit: 670000 }
      );

      events = (await mintTx.wait()).events;
      const tokenId3 = await events[events.length - 1].args.tokenId.toNumber();

      await NonFungiblePositionManager.setApprovalForAll(DepositRecipes.address, true);
      await DepositRecipes.connect(user).depositUniNft([tokenId1, tokenId2, tokenId3]);

      expect(await NonFungiblePositionManager.ownerOf(tokenId1)).to.equal(PositionManager.address);
      expect(await NonFungiblePositionManager.ownerOf(tokenId2)).to.equal(PositionManager.address);
      expect(await NonFungiblePositionManager.ownerOf(tokenId3)).to.equal(PositionManager.address);
      const positions = await PositionManager.getAllUniPositions();
      expect(positions[positions.length - 3]).to.equal(tokenId1);
      expect(positions[positions.length - 2]).to.equal(tokenId2);
      expect(positions[positions.length - 1]).to.equal(tokenId3);
    });

    it('should revert if user is not owner', async function () {
      const mintTx = await NonFungiblePositionManager.connect(liquidityProvider).mint(
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

      const events: any = (await mintTx.wait()).events;
      const tokenId = await events[events.length - 1].args.tokenId.toNumber();

      await NonFungiblePositionManager.setApprovalForAll(DepositRecipes.address, true);
      await expect(DepositRecipes.connect(user).depositUniNft([tokenId])).to.be.reverted;
    });

    it('Should deposit and check if autocompoud is 5% and activated', async function () {
      const mintTx = await NonFungiblePositionManager.connect(user).mint(
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
          recipient: user.address,
          deadline: Date.now() + 1000,
        },
        { gasLimit: 670000 }
      );

      const events: any = (await mintTx.wait()).events;
      const tokenId = await events[events.length - 1].args.tokenId.toNumber();

      await DepositRecipes.connect(user).depositUniNft([tokenId]);
      const moduleData = await PositionManager.getModuleInfo(tokenId, AutoCompoundModule.address);

      console.log('autocompound address: ', AutoCompoundModule.address);
      expect(moduleData[0]).to.be.equal(true);
      expect(moduleData[1]).to.be.equal(abiCoder.encode(['uint256'], [5]));
    });
  });

  describe('DepositRecipes.mintAndDeposit()', function () {
    it('should correctly mint and deposit a token', async function () {
      const amount0 = '0x' + (1e15).toString(16);
      const amount1 = '0x' + (1e15).toString(16);
      const fee = 500;
      const tickLower = 0 - 60 * 1000;
      const tickUpper = 0 + 60 * 1000;

      const mintTx = await DepositRecipes.connect(user).mintAndDeposit(
        tokenEth.address,
        tokenUsdc.address,
        fee,
        tickLower,
        tickUpper,
        amount0,
        amount1
      );

      const events: any = (await mintTx.wait()).events;
      const mintEvent = await events[events.length - 1];
      let tokenId = abiCoder.decode(['uint256'], mintEvent.data).toString();

      expect(await NonFungiblePositionManager.ownerOf(tokenId)).to.equal(PositionManager.address);
      const positions = await PositionManager.getAllUniPositions();
      expect(positions[positions.length - 1]).to.equal(tokenId);
    });

    it('should revert if pool does not exist', async function () {
      const amount0 = '0x' + (1e15).toString(16);
      const amount1 = '0x' + (1e15).toString(16);
      const fee = 2393;
      const tickLower = 0 - 60 * 1000;
      const tickUpper = 0 + 60 * 1000;

      await expect(
        DepositRecipes.connect(user).mintAndDeposit(
          tokenEth.address,
          tokenUsdc.address,
          amount0,
          amount1,
          tickLower,
          tickUpper,
          fee
        )
      ).to.be.reverted;
    });

    it('should revert if ticks are not multiples of tick spacing', async function () {
      const amount0 = '0x' + (1e15).toString(16);
      const amount1 = '0x' + (1e15).toString(16);
      const fee = 3000;
      const tickLower = 0 - 734;
      const tickUpper = 0 + 3459;

      await expect(
        DepositRecipes.connect(user).mintAndDeposit(
          tokenEth.address,
          tokenUsdc.address,
          amount0,
          amount1,
          tickLower,
          tickUpper,
          fee
        )
      ).to.be.reverted;
    });
  });

  describe('DepositRecipes.zapIn()', function () {
    it('should correctly zap into a position', async function () {
      const amountIn = 1e8;
      const fee = 3000;
      const tickLower = 0 - 60 * 1000;
      const tickUpper = 0 + 60 * 1000;
      const zapInTx = await DepositRecipes.connect(user).zapInUniNft(
        tokenEth.address,
        amountIn,
        tokenDai.address,
        tokenUsdc.address,
        tickLower,
        tickUpper,
        fee
      );

      const events: any = (await zapInTx.wait()).events;
      const mintEvent = await events[events.length - 1];
      let tokenId = abiCoder.decode(['uint256', 'address', 'uint256'], mintEvent.data)[0].toString();

      expect(PositionManager.address).to.be.equal(await NonFungiblePositionManager.ownerOf(tokenId));
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
      const zapInTx = await DepositRecipes.connect(user).zapInUniNft(
        tokenEth.address,
        amountIn,
        tokenEth.address,
        tokenUsdc.address,
        tickLower,
        tickUpper,
        fee
      );

      const events: any = (await zapInTx.wait()).events;
      const mintEvent = await events[events.length - 1];
      let tokenId = abiCoder.decode(['uint256', 'address', 'uint256'], mintEvent.data)[0].toString();

      expect(PositionManager.address).to.be.equal(await NonFungiblePositionManager.ownerOf(tokenId));

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
        DepositRecipes.connect(user).zapInUniNft(
          tokenEth.address,
          amountIn,
          tokenEth.address,
          tokenUsdc.address,
          tickLower,
          tickUpper,
          fee
        )
      ).to.be.reverted;
    });

    it('should revert if ticks are not multiples of tick spacing', async function () {
      const amount0 = '0x' + (1e15).toString(16);
      const amount1 = '0x' + (1e15).toString(16);
      const fee = 3000;
      const tickLower = 0 - 734;
      const tickUpper = 0 + 3459;

      await expect(
        DepositRecipes.connect(user).mintAndDeposit(
          tokenEth.address,
          tokenUsdc.address,
          amount0,
          amount1,
          tickLower,
          tickUpper,
          fee
        )
      ).to.be.reverted;
    });
  });
});
