import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ContractFactory, Contract } from 'ethers';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import UniswapV3Factoryjson from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json';
import NonFungiblePositionManagerjson from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json';
import NonFungiblePositionManagerDescriptorjson from '@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json';
import SwapRouterjson from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json';
import PositionManagerjson from '../../../artifacts/contracts/PositionManager.sol/PositionManager.json';
import {
  NonFungiblePositionManagerDescriptorBytecode,
  tokensFixture,
  poolFixture,
  mintSTDAmount,
  RegistryFixture,
  getSelectors,
} from '../../shared/fixtures';
import {
  MockToken,
  IUniswapV3Pool,
  INonfungiblePositionManager,
  WithdrawRecipes,
  DepositRecipes,
  PositionManager,
  MockUniswapNFTHelper,
} from '../../../typechain';
import { DepositRecipesInterface } from '../../../typechain/DepositRecipes';

describe('WithdrawRecipes.sol', function () {
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
  let WithdrawRecipes: WithdrawRecipes;
  let DepositRecipes: DepositRecipes;
  let PositionManager: PositionManager;
  let PositionManagerFactory: Contract;
  let PositionManagerFactoryFactory: ContractFactory;
  let DiamondCutFacet: Contract;
  let UniswapAddressHolder: Contract;
  let registry: Contract;
  let ClosePosition: Contract;
  let MockUniswapNFTHelper: MockUniswapNFTHelper;
  let tokenId: any;

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
      NonFungiblePositionManagerDescriptorBytecode,
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
    const UniswapAddressHolderFactory = await ethers.getContractFactory('UniswapAddressHolder');
    UniswapAddressHolder = await UniswapAddressHolderFactory.deploy(
      NonFungiblePositionManager.address,
      Factory.address,
      SwapRouter.address
    );
    await UniswapAddressHolder.deployed();

    const DiamondCutFacetFactory = await ethers.getContractFactory('DiamondCutFacet');
    DiamondCutFacet = await DiamondCutFacetFactory.deploy();
    await DiamondCutFacet.deployed();

    //deploy mint contract
    const ClosePositionFactory = await ethers.getContractFactory('ClosePosition');
    const closePositionAction = await ClosePositionFactory.deploy();
    await closePositionAction.deployed();

    //deploy decreaseLiquidity contract
    const DecreaseLiquidityFactory = await ethers.getContractFactory('DecreaseLiquidity');
    const decreaseLiquidityAction = await DecreaseLiquidityFactory.deploy();
    await decreaseLiquidityAction.deployed();

    //deploy collectFees contract+
    const CollectFeesFactory = await ethers.getContractFactory('CollectFees');
    const collectFeesAction = await CollectFeesFactory.deploy();
    await collectFeesAction.deployed();

    //deploy zapIn contract
    const ZapOutFactory = await ethers.getContractFactory('ZapOut');
    const zapOutAction = await ZapOutFactory.deploy();
    await zapOutAction.deployed();

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
    //recipient: NonfungiblePositionManager - spender: user
    await tokenEth
      .connect(user)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc
      .connect(user)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    await tokenDai
      .connect(user)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));

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

    //deploy the PositionManagerFactory => deploy PositionManager
    PositionManagerFactoryFactory = (await ethers.getContractFactory('PositionManagerFactory')) as ContractFactory;
    PositionManagerFactory = (await PositionManagerFactoryFactory.deploy()) as Contract;
    await PositionManagerFactory.deployed();

    // deploy Registry
    registry = (await RegistryFixture(user.address, PositionManagerFactory.address)).registryFixture;
    await registry.deployed();

    //deploy the PositionManagerFactory => deploy PositionManager
    await PositionManagerFactory.create(
      user.address,
      DiamondCutFacet.address,
      UniswapAddressHolder.address,
      registry.address,
      '0x0000000000000000000000000000000000000000'
    );

    let contractsDeployed = await PositionManagerFactory.positionManagers(0);
    PositionManager = (await ethers.getContractAt(PositionManagerjson['abi'], contractsDeployed)) as PositionManager;

    await registry.addNewContract(hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Test')), user.address);

    // add actions to position manager using diamond pattern
    const cut = [];
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

    cut.push({
      facetAddress: closePositionAction.address,
      action: FacetCutAction.Add,
      functionSelectors: await getSelectors(closePositionAction),
    });
    cut.push({
      facetAddress: zapOutAction.address,
      action: FacetCutAction.Add,
      functionSelectors: await getSelectors(zapOutAction),
    });
    cut.push({
      facetAddress: decreaseLiquidityAction.address,
      action: FacetCutAction.Add,
      functionSelectors: await getSelectors(decreaseLiquidityAction),
    });
    cut.push({
      facetAddress: collectFeesAction.address,
      action: FacetCutAction.Add,
      functionSelectors: await getSelectors(collectFeesAction),
    });

    const diamondCut = await ethers.getContractAt('IDiamondCut', PositionManager.address);

    const tx = await diamondCut.diamondCut(cut, '0x0000000000000000000000000000000000000000', []);

    //deploy WithdrawRecipes contract
    let WithdrawRecipesFactory = await ethers.getContractFactory('WithdrawRecipes');
    WithdrawRecipes = (await WithdrawRecipesFactory.deploy(
      PositionManagerFactory.address,
      UniswapAddressHolder.address
    )) as WithdrawRecipes;
    await WithdrawRecipes.deployed();

    let DepositRecipesFactory = await ethers.getContractFactory('DepositRecipes');
    DepositRecipes = (await DepositRecipesFactory.deploy(
      NonFungiblePositionManager.address,
      PositionManagerFactory.address
    )) as DepositRecipes;
    await DepositRecipes.deployed();

    let MockUniswapNFTHelperFactory = await ethers.getContractFactory('MockUniswapNFTHelper');
    MockUniswapNFTHelper = (await MockUniswapNFTHelperFactory.deploy()) as MockUniswapNFTHelper;
    await MockUniswapNFTHelper.deployed();

    await registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('DepositRecipes')),
      DepositRecipes.address
    );
    await registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('WithdrawRecipes')),
      WithdrawRecipes.address
    );

    //recipient: positionManager - spender: user
    await tokenEth.connect(user).approve(DepositRecipes.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc.connect(user).approve(DepositRecipes.address, ethers.utils.parseEther('100000000000000'));
    await tokenDai.connect(user).approve(DepositRecipes.address, ethers.utils.parseEther('100000000000000'));
  });

  beforeEach(async function () {
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
    tokenId = await events[events.length - 1].args.tokenId.toNumber();

    await NonFungiblePositionManager.setApprovalForAll(DepositRecipes.address, true);
    await DepositRecipes.connect(user).depositUniNft([tokenId]);
  });

  describe('WithdrawRecipes.withdrawUniNft()', function () {
    it('should fully withdraw an UniNft', async function () {
      expect(await NonFungiblePositionManager.ownerOf(tokenId)).to.be.equal(PositionManager.address);
      const balanceBefore = await tokenUsdc.balanceOf(user.address);

      await WithdrawRecipes.connect(user).withdrawUniNft(tokenId, 10000);
      expect(await tokenUsdc.balanceOf(user.address)).to.be.gt(balanceBefore);
      await expect(NonFungiblePositionManager.ownerOf(tokenId)).to.be.reverted;
    });

    it('should withdraw a percentage of UniNft', async function () {
      expect(await NonFungiblePositionManager.ownerOf(tokenId)).to.be.equal(PositionManager.address);
      const balanceBefore = await tokenUsdc.balanceOf(user.address);
      const [amount0Before, amount1Before] = await MockUniswapNFTHelper.getAmountsfromTokenId(
        tokenId,
        NonFungiblePositionManager.address,
        UniswapAddressHolder.uniswapV3FactoryAddress()
      );

      const percentageToWithdraw = 5000;
      await WithdrawRecipes.connect(user).withdrawUniNft(tokenId, percentageToWithdraw);

      const [amount0After, amount1After] = await MockUniswapNFTHelper.getAmountsfromTokenId(
        tokenId,
        NonFungiblePositionManager.address,
        UniswapAddressHolder.uniswapV3FactoryAddress()
      );

      expect(amount0Before.toNumber()).to.be.closeTo(2 * amount0After.toNumber(), amount0After.toNumber() / 100);
      expect(amount1Before.toNumber()).to.be.closeTo(2 * amount1After.toNumber(), amount1After.toNumber() / 100);

      const balanceAfter = await tokenUsdc.balanceOf(user.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
      await expect(NonFungiblePositionManager.ownerOf(tokenId)).to.not.be.reverted;
    });

    it('should withdraw UniNft zapping out', async function () {
      expect(await NonFungiblePositionManager.ownerOf(tokenId)).to.be.equal(PositionManager.address);
      const balanceBefore = await tokenDai.balanceOf(user.address);

      await WithdrawRecipes.connect(user).zapOutUniNft(tokenId, tokenDai.address);
      expect(await tokenDai.balanceOf(user.address)).to.be.gt(balanceBefore);
      await expect(NonFungiblePositionManager.ownerOf(tokenId)).to.be.reverted;
    });
  });
});
