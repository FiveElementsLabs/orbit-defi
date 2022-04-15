import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ContractFactory, Contract, BigNumber } from 'ethers';
import { AbiCoder } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
const hre = require('hardhat');
const UniswapV3Factoryjson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');
const NonFungiblePositionManagerjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');
const NonFungiblePositionManagerDescriptorjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json');
const PositionManagerjson = require('../artifacts/contracts/PositionManager.sol/PositionManager.json');
const SwapRouterjson = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json');
const FixturesConst = require('../test/shared/fixtures');
import { tokensFixture, poolFixture, mintSTDAmount, routerFixture } from '../test/shared/fixtures';
import { MockToken, IUniswapV3Pool, INonfungiblePositionManager, SwapToPositionRatio } from '../typechain';

export const keeperSetup = async () => {
  //GLOBAL VARIABLE - USE THIS
  let user: any = ethers.getSigners().then(async (signers) => {
    return signers[0];
  });
  let liquidityProvider: any = ethers.getSigners().then(async (signers) => {
    return signers[1];
  });

  let user2: any = ethers.getSigners().then(async (signers) => {
    return signers[2];
  });

  //all the token used globally
  let tokenEth: MockToken, tokenUsdc: MockToken, tokenDai: MockToken;

  //all the pools used globally
  let Pool0: IUniswapV3Pool;

  let Factory: Contract; // the factory that will deploy all pools
  let NonFungiblePositionManager: INonfungiblePositionManager; // NonFungiblePositionManager contract by UniswapV3
  let PositionManager: Contract; // PositionManager contract by UniswapV3
  let SwapRouter: Contract; // SwapRouter contract by UniswapV3
  let Router: Contract; //UniswapV3 Router
  let SwapToPositionRatioAction: SwapToPositionRatio; // SwapToPositionRatio contract
  let IdleLiquidityModule: Contract; // IdleLiquidityModule contract
  let collectFeesAction: Contract;
  let increaseLiquidityAction: Contract;
  let decreaseLiquidityAction: Contract;
  let updateFeesAction: Contract;
  let AutoCompound: Contract;

  let abiCoder: AbiCoder;
  let UniswapAddressHolder: Contract; // address holder for UniswapV3 contracts

  await hre.network.provider.send('hardhat_reset');

  user = await user; //owner of the smart vault, a normal user
  user2 = await user2;
  liquidityProvider = await liquidityProvider;

  //deploy first 3 tokens - ETH, USDC, DAI
  tokenEth = (await tokensFixture('ETH', 18)).tokenFixture;
  tokenUsdc = (await tokensFixture('USDC', 6)).tokenFixture;
  tokenDai = (await tokensFixture('DAI', 18)).tokenFixture;

  //deploy factory, used for pools
  const uniswapFactoryFactory = new ContractFactory(
    UniswapV3Factoryjson['abi'],
    UniswapV3Factoryjson['bytecode'],
    user
  );
  Factory = (await uniswapFactoryFactory.deploy()) as Contract;
  await Factory.deployed();

  //deploy first pool
  Pool0 = (await poolFixture(tokenEth, tokenUsdc, 3000, Factory)).pool;

  //mint 1e30 token, you can call with arbitrary amount
  await tokenEth.mint(user.address, ethers.utils.parseEther('1000000000000'));
  await tokenEth.mint(user2.address, ethers.utils.parseEther('1000000000000'));
  await tokenEth.mint(liquidityProvider.address, ethers.utils.parseEther('1000000000000'));
  await tokenUsdc.mint(user.address, ethers.utils.parseEther('1000000000000'));
  await tokenUsdc.mint(liquidityProvider.address, ethers.utils.parseEther('1000000000000'));
  await tokenUsdc.mint(user2.address, ethers.utils.parseEther('1000000000000'));

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

  //deploy swap router
  const SwapRouterFactory = new ContractFactory(SwapRouterjson['abi'], SwapRouterjson['bytecode'], user);
  SwapRouter = (await SwapRouterFactory.deploy(Factory.address, tokenEth.address)) as Contract;
  await SwapRouter.deployed();

  //deploy router
  Router = (await routerFixture()).ruoterDeployFixture;

  //deploy uniswapAddressHolder
  const UniswapAddressHolderFactory = await ethers.getContractFactory('UniswapAddressHolder');
  UniswapAddressHolder = (await UniswapAddressHolderFactory.deploy(
    NonFungiblePositionManager.address,
    Factory.address,
    SwapRouter.address
  )) as Contract;
  await UniswapAddressHolder.deployed();

  //deploy the PositionManagerFactory => deploy PositionManager
  const PositionManagerFactoryFactory = await ethers.getContractFactory('PositionManagerFactory');
  const PositionManagerFactory = (await PositionManagerFactoryFactory.deploy()) as Contract;
  await PositionManagerFactory.deployed();

  console.log('NonFungiblePositionManager.address: ', NonFungiblePositionManager.address);
  console.log('PositionManagerFactory.address: ', PositionManagerFactory.address);

  const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet');
  const diamondCutFacet = await DiamondCutFacet.deploy();
  await diamondCutFacet.deployed();

  await PositionManagerFactory.create(user.address, diamondCutFacet.address, UniswapAddressHolder.address);

  const contractsDeployed = await PositionManagerFactory.positionManagers(0);
  PositionManager = (await ethers.getContractAt(PositionManagerjson['abi'], contractsDeployed)) as Contract;

  //Deploy SwapToPositionRatio Action
  const swapToPositionRatioActionFactory = await ethers.getContractFactory('SwapToPositionRatio');
  SwapToPositionRatioAction = (await swapToPositionRatioActionFactory.deploy()) as SwapToPositionRatio;
  await SwapToPositionRatioAction.deployed();

  //Deploy IdleLiquidityModule
  const idleLiquidityModuleFactory = await ethers.getContractFactory('IdleLiquidityModule');
  IdleLiquidityModule = (await idleLiquidityModuleFactory.deploy(UniswapAddressHolder.address)) as Contract;
  await IdleLiquidityModule.deployed();

  //deploy actions needed for Autocompound
  const collectFeesActionFactory = await ethers.getContractFactory('CollectFees');
  collectFeesAction = await collectFeesActionFactory.deploy();
  await collectFeesAction.deployed();

  const increaseLiquidityActionFactory = await ethers.getContractFactory('IncreaseLiquidity');
  increaseLiquidityAction = await increaseLiquidityActionFactory.deploy();
  await increaseLiquidityAction.deployed();

  const decreaseLiquidityActionFactory = await ethers.getContractFactory('DecreaseLiquidity');
  decreaseLiquidityAction = await decreaseLiquidityActionFactory.deploy();
  await decreaseLiquidityAction.deployed();

  const updateFeesActionFactory = await ethers.getContractFactory('UpdateUncollectedFees');
  updateFeesAction = await updateFeesActionFactory.deploy();
  await updateFeesAction.deployed();

  //deploy AutoCompound Module
  const AutocompoundFactory = await ethers.getContractFactory('AutoCompoundModule');
  AutoCompound = await AutocompoundFactory.deploy(UniswapAddressHolder.address);
  await AutoCompound.deployed();

  //get AbiCoder
  abiCoder = ethers.utils.defaultAbiCoder;

  //APPROVE
  //recipient: SwapToPositionRatio action - spender: user
  await tokenEth.connect(user).approve(SwapToPositionRatioAction.address, ethers.utils.parseEther('100000000000000'));
  await tokenUsdc.connect(user).approve(SwapToPositionRatioAction.address, ethers.utils.parseEther('100000000000000'));
  //recipient: NonFungiblePositionManager - spender: liquidityProvider
  await tokenEth
    .connect(liquidityProvider)
    .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
  await tokenUsdc
    .connect(liquidityProvider)
    .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
  //recipient: NonFungiblePositionManager - spender: liquidityProvider
  await tokenEth.connect(user).approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
  await tokenUsdc.connect(user).approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
  //recipient: Router - spender: liquidityProvider
  await tokenEth.connect(liquidityProvider).approve(Router.address, ethers.utils.parseEther('1000000000000'));
  await tokenUsdc.connect(liquidityProvider).approve(Router.address, ethers.utils.parseEther('1000000000000'));

  //give PositionManager some tokens
  await tokenEth.connect(user).transfer(PositionManager.address, ethers.utils.parseEther('100000'));
  await tokenUsdc.connect(user).transfer(PositionManager.address, ethers.utils.parseEther('100000'));

  //approval nfts
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

  //mint NFT
  const txMint = await NonFungiblePositionManager.connect(user).mint(
    {
      token0: tokenEth.address,
      token1: tokenUsdc.address,
      fee: 3000,
      tickLower: 0 - 60 * 2,
      tickUpper: 0 + 60 * 2,
      amount0Desired: '0x' + (1e9).toString(16),
      amount1Desired: '0x' + (1e9).toString(16),
      amount0Min: 0,
      amount1Min: 0,
      recipient: user.address,
      deadline: Date.now() + 1000,
    },
    { gasLimit: 670000 }
  );

  const receipt: any = await txMint.wait();
  const tokenId = receipt.events[receipt.events.length - 1].args.tokenId;

  await PositionManager.connect(user).depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), [tokenId]);

  //mint NFT
  const txMint2 = await NonFungiblePositionManager.connect(user).mint(
    {
      token0: tokenEth.address,
      token1: tokenUsdc.address,
      fee: 3000,
      tickLower: 0 - 60 * 1000,
      tickUpper: 0 + 60 * 1000,
      amount0Desired: '0x' + (1e9).toString(16),
      amount1Desired: '0x' + (1e9).toString(16),
      amount0Min: 0,
      amount1Min: 0,
      recipient: user.address,
      deadline: Date.now() + 1000,
    },
    { gasLimit: 670000 }
  );

  const receipt2: any = await txMint2.wait();
  const tokenId2 = receipt2.events[receipt2.events.length - 1].args.tokenId;

  await PositionManager.connect(user).depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId2), [tokenId2]);
  console.log(PositionManager.address);
  console.log(await PositionManager.getAllUniPositions());
  console.log(await PositionManagerFactory.userToPositionManager(user.address));
  console.log(user.address);

  for (let i = 0; i < 20; i++) {
    // Do a trade to change tick
    await Router.connect(liquidityProvider).swap(Pool0.address, false, '0x' + (4e23).toString(16));
  }

  return {
    tokenEth,
    tokenUsdc,
    Pool0,
    NonFungiblePositionManager,
    PositionManager,
    PositionManagerFactory,
    SwapRouter,
    SwapToPositionRatioAction,
    IdleLiquidityModule,
    UniswapAddressHolder,
    Factory,
    tokenId,
    tokenId2,
    user,
    AutoCompound,
  };
};
