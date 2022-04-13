import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ContractFactory, Contract } from 'ethers';
import { AbiCoder } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
const hre = require('hardhat');
const UniswapV3Factoryjson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');
const NonFungiblePositionManagerjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');
const NonFungiblePositionManagerDescriptorjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json');
const PositionManagerjson = require('../artifacts/contracts/PositionManager.sol/PositionManager.json');
const SwapRouterjson = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json');
const FixturesConst = require('./shared/fixtures');
import { tokensFixture, poolFixture, mintSTDAmount, routerFixture, getSelectors } from './shared/fixtures';
import { MockToken, IUniswapV3Pool, INonfungiblePositionManager, PositionManager, TestRouter } from '../typechain';

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
  let MintAction: Contract;
  let IncreaseLiquidityAction: Contract;
  let IncreaseLiquidityActionNew: Contract;
  let IncreaseLiquidityFallback: Contract;
  let abiCoder: AbiCoder;

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    user = await user; //owner of the smart vault, a normal user
    liquidityProvider = await liquidityProvider; //generic address as other users, mint pool liquidity, try to do onlyUser call etc
    trader = await trader; //used for swap

    //deploy first 3 token - ETH, USDC, DAI
    tokenEth = (await tokensFixture('ETH', 18)).tokenFixture;
    tokenUsdc = (await tokensFixture('USDC', 6)).tokenFixture;
    tokenDai = (await tokensFixture('DAI', 18)).tokenFixture;

    //deploy factory, used for pools
    const uniswapFactoryFactory = new ContractFactory(
      UniswapV3Factoryjson['abi'],
      UniswapV3Factoryjson['bytecode'],
      user
    );
    Factory = await uniswapFactoryFactory.deploy();
    await Factory.deployed();

    //deploy first 2 pools
    Pool0 = (await poolFixture(tokenEth, tokenUsdc, 3000, Factory)).pool;
    Pool1 = (await poolFixture(tokenEth, tokenDai, 3000, Factory)).pool;

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

    // deploy DiamondCutFacet ----------------------------------------------------------------------
    const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet');
    const diamondCutFacet = await DiamondCutFacet.deploy();
    await diamondCutFacet.deployed();

    //deploy the PositionManagerFactory => deploy PositionManager
    const PositionManagerFactoryFactory = await ethers.getContractFactory('PositionManagerFactory');
    const PositionManagerFactory = (await PositionManagerFactoryFactory.deploy()) as Contract;
    await PositionManagerFactory.deployed();

    await PositionManagerFactory.create(user.address, diamondCutFacet.address, uniswapAddressHolder.address);

    const contractsDeployed = await PositionManagerFactory.positionManagers(0);
    PositionManager = (await ethers.getContractAt(PositionManagerjson['abi'], contractsDeployed)) as PositionManager;

    //deploy an action to test
    const ActionFactory = await ethers.getContractFactory('Mint');
    MintAction = await ActionFactory.deploy();
    await MintAction.deployed();

    //Deploy IncreaseLiquidity Action
    const IncreaseLiquidityActionFactory = await ethers.getContractFactory('IncreaseLiquidity');
    IncreaseLiquidityAction = (await IncreaseLiquidityActionFactory.deploy()) as Contract;
    await IncreaseLiquidityAction.deployed();

    //Deploy IncreaseLiquidity Action
    const IncreaseLiquidityActionFactoryNew = await ethers.getContractFactory('IncreaseLiquidity');
    IncreaseLiquidityActionNew = (await IncreaseLiquidityActionFactoryNew.deploy()) as Contract;
    await IncreaseLiquidityActionNew.deployed();

    //select standard abicoder
    abiCoder = ethers.utils.defaultAbiCoder;

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
    /* //recipient: MintAction - spender: user
    await tokenEth.connect(user).approve(MintAction.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc.connect(user).approve(MintAction.address, ethers.utils.parseEther('100000000000000')); */

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

    const mintReceipt = (await txMint.wait()) as any;
    tokenId = mintReceipt.events[mintReceipt.events.length - 1].args.tokenId;
  });

  describe('PositionManager - depositUniNft', function () {
    it('should deposit a single UNI NFT', async function () {
      const oldOwner = await NonFungiblePositionManager.ownerOf(tokenId);

      await PositionManager.connect(user).depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), [tokenId]);

      expect(oldOwner).to.be.not.equal(await NonFungiblePositionManager.ownerOf(tokenId));
      expect(PositionManager.address).to.be.equal(await NonFungiblePositionManager.ownerOf(tokenId));
    });

    it('should deposit multiple UNI NFTs', async function () {
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

      const mintReceipt = (await txMint.wait()) as any;
      const newTokenId = mintReceipt.events[mintReceipt.events.length - 1].args.tokenId;

      await PositionManager.connect(user).depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), [
        tokenId,
        newTokenId,
      ]);

      expect(PositionManager.address).to.be.equal(await NonFungiblePositionManager.ownerOf(tokenId));
      expect(PositionManager.address).to.be.equal(await NonFungiblePositionManager.ownerOf(newTokenId));
    });
  });
  describe('PositionManager - withdrawUniNft', function () {
    it('Should withdraw a single UNI NFT', async function () {
      await PositionManager.connect(user).depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), [tokenId]);

      await PositionManager.connect(user).withdrawUniNft(user.address, tokenId);

      expect(await user.address).to.equal(await NonFungiblePositionManager.ownerOf(tokenId));
    });
    it('Should revert if token does not exist', async function () {
      await expect(PositionManager.connect(user).withdrawUniNft(user.address, 1000)).to.be.reverted;
    });
  });

  describe('PositionManager - OnlyUser Modifier', function () {
    it('depositUniNft', async function () {
      await expect(
        PositionManager.connect(trader).depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), [tokenId])
      ).to.be.reverted;
    });

    it('withdrawUniNft', async function () {
      await PositionManager.connect(user).depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), [tokenId]);

      await expect(PositionManager.connect(trader).withdrawUniNft(user.address, tokenId)).to.be.reverted;
    });
  });
  describe('PositionManager - DiamondCut', function () {
    it('should add a new action and call it', async function () {
      // add actions to position manager using diamond cut
      const cut = [];
      const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

      cut.push({
        facetAddress: IncreaseLiquidityAction.address,
        action: FacetCutAction.Add,
        functionSelectors: await getSelectors(IncreaseLiquidityAction),
      });

      const diamondCut = await ethers.getContractAt('IDiamondCut', PositionManager.address);

      await diamondCut.diamondCut(cut, '0x0000000000000000000000000000000000000000', []);

      IncreaseLiquidityFallback = await ethers.getContractAt('IIncreaseLiquidity', PositionManager.address);

      const poolTokenId = 1;
      const liquidityBefore = (await NonFungiblePositionManager.positions(poolTokenId)).liquidity;

      const amount0Desired = 1e4;
      const amount1Desired = 1e6;

      await expect(
        IncreaseLiquidityFallback.connect(user).increaseLiquidity(poolTokenId, amount0Desired, amount1Desired)
      ).to.not.reverted;
    });
    it('should revert if replace a wrong one function address', async function () {
      // add actions to position manager using diamond cut
      const cut = [];
      const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

      cut.push({
        facetAddress: MintAction.address,
        action: FacetCutAction.Replace,
        functionSelectors: await getSelectors(IncreaseLiquidityAction),
      });

      const diamondCut = await ethers.getContractAt('IDiamondCut', PositionManager.address);

      await diamondCut.diamondCut(cut, '0x0000000000000000000000000000000000000000', []);

      IncreaseLiquidityFallback = await ethers.getContractAt('IIncreaseLiquidity', PositionManager.address);

      const poolTokenId = 1;
      const liquidityBefore = (await NonFungiblePositionManager.positions(poolTokenId)).liquidity;

      const amount0Desired = 1e4;
      const amount1Desired = 1e6;

      await expect(
        IncreaseLiquidityFallback.connect(user).increaseLiquidity(poolTokenId, amount0Desired, amount1Desired)
      ).to.be.reverted;
    });
    it('should replace onefunction address', async function () {
      // add actions to position manager using diamond cut
      const cut = [];
      const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

      cut.push({
        facetAddress: IncreaseLiquidityActionNew.address,
        action: FacetCutAction.Replace,
        functionSelectors: await getSelectors(IncreaseLiquidityAction),
      });

      const diamondCut = await ethers.getContractAt('IDiamondCut', PositionManager.address);

      await diamondCut.diamondCut(cut, '0x0000000000000000000000000000000000000000', []);

      IncreaseLiquidityFallback = await ethers.getContractAt('IIncreaseLiquidity', PositionManager.address);

      const poolTokenId = 1;
      const liquidityBefore = (await NonFungiblePositionManager.positions(poolTokenId)).liquidity;

      const amount0Desired = 1e4;
      const amount1Desired = 1e6;

      await expect(
        IncreaseLiquidityFallback.connect(user).increaseLiquidity(poolTokenId, amount0Desired, amount1Desired)
      ).to.not.reverted;
    });
    it('should remove onefunction address', async function () {
      // add actions to position manager using diamond cut
      const cut = [];
      const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

      cut.push({
        facetAddress: '0x0000000000000000000000000000000000000000',
        action: FacetCutAction.Remove,
        functionSelectors: await getSelectors(IncreaseLiquidityAction),
      });

      const diamondCut = await ethers.getContractAt('IDiamondCut', PositionManager.address);

      await diamondCut.diamondCut(cut, '0x0000000000000000000000000000000000000000', []);
      IncreaseLiquidityFallback = await ethers.getContractAt('IIncreaseLiquidity', PositionManager.address);

      const poolTokenId = 1;
      const liquidityBefore = (await NonFungiblePositionManager.positions(poolTokenId)).liquidity;

      const amount0Desired = 1e4;
      const amount1Desired = 1e6;

      await expect(
        IncreaseLiquidityFallback.connect(user).increaseLiquidity(poolTokenId, amount0Desired, amount1Desired)
      ).to.be.reverted;
    });
  });
});
