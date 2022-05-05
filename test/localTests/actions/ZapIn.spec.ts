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
  getSelectors,
  RegistryFixture,
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
  let ZapInFallback: ZapIn;
  let PositionManager: PositionManager;

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
    const uniswapAddressHolderFactory = await ethers.getContractFactory('UniswapAddressHolder');
    const uniswapAddressHolder = await uniswapAddressHolderFactory.deploy(
      NonFungiblePositionManager.address,
      Factory.address,
      SwapRouter.address
    );
    await uniswapAddressHolder.deployed();

    //deploy ZapOut Action
    const ZapOutFactory = await ethers.getContractFactory('ZapIn');
    const ZapInAction = (await ZapOutFactory.deploy()) as ZapIn;
    await ZapInAction.deployed();

    const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet');
    const diamondCutFacet = await DiamondCutFacet.deploy();
    await diamondCutFacet.deployed();

    //deploy the PositionManagerFactory => deploy PositionManager
    const PositionManagerFactoryFactory = await ethers.getContractFactory('PositionManagerFactory');
    const PositionManagerFactory = (await PositionManagerFactoryFactory.deploy()) as Contract;
    await PositionManagerFactory.deployed();

    // deploy Registry
    const registry = (await RegistryFixture(user.address, PositionManagerFactory.address)).registryFixture;
    await registry.deployed();

    await PositionManagerFactory.create(
      user.address,
      diamondCutFacet.address,
      uniswapAddressHolder.address,
      registry.address,
      '0x0000000000000000000000000000000000000000'
    );

    const contractsDeployed = await PositionManagerFactory.positionManagers(0);
    PositionManager = (await ethers.getContractAt(PositionManagerjson['abi'], contractsDeployed)) as PositionManager;

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
    //recipient: positionManager - spender: user
    await tokenEth.connect(user).approve(PositionManager.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc.connect(user).approve(PositionManager.address, ethers.utils.parseEther('100000000000000'));
    //approval user to registry for test
    await registry.addNewContract(hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Test')), user.address);

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

    // add actions to position manager using diamond pattern
    const cut = [];
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

    cut.push({
      facetAddress: ZapInAction.address,
      action: FacetCutAction.Add,
      functionSelectors: await getSelectors(ZapInAction),
    });

    const diamondCut = await ethers.getContractAt('IDiamondCut', PositionManager.address);

    await diamondCut.diamondCut(cut, '0x0000000000000000000000000000000000000000', []);

    ZapInFallback = (await ethers.getContractAt('IZapIn', PositionManager.address)) as ZapIn;
  });

  describe('ZapIn.sol', function () {
    it('should correctly exit a position', async function () {});
  });
});
