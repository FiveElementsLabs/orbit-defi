import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ContractFactory, Contract } from 'ethers';
import { AbiCoder } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import UniswapV3Factoryjson from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json';
import NonFungiblePositionManagerjson from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json';
import NonFungiblePositionManagerDescriptorjson from '@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json';
import PositionManagerjson from '../../../artifacts/contracts/PositionManager.sol/PositionManager.json';
import SwapRouterjson from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json';
import {
  NonFungiblePositionManagerDescriptorBytecode,
  tokensFixture,
  poolFixture,
  mintSTDAmount,
  routerFixture,
  getSelectors,
} from '../../shared/fixtures';
import {
  MockToken,
  IUniswapV3Pool,
  INonfungiblePositionManager,
  PositionManager,
  TestRouter,
  AutoCompoundModule,
} from '../../../typechain';

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
  let Router: TestRouter; //Our router to perform swap
  let SwapRouter: Contract;
  let collectFeesAction: Contract;
  let increaseLiquidityAction: Contract;
  let decreaseLiquidityAction: Contract;
  let updateFeesAction: Contract;
  let autoCompound: Contract;
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

    // deploy DiamondCutFacet ----------------------------------------------------------------------
    const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet');
    const diamondCutFacet = await DiamondCutFacet.deploy();
    await diamondCutFacet.deployed();

    // deploy Registry
    const Registry = await ethers.getContractFactory('Registry');
    const registry = await Registry.deploy(user.address);
    await registry.deployed();

    //deploy the PositionManagerFactory => deploy PositionManager
    const PositionManagerFactoryFactory = await ethers.getContractFactory('PositionManagerFactory');
    const PositionManagerFactory = (await PositionManagerFactoryFactory.deploy()) as Contract;
    await PositionManagerFactory.deployed();

    await PositionManagerFactory.create(
      user.address,
      diamondCutFacet.address,
      uniswapAddressHolder.address,
      registry.address,
      '0x0000000000000000000000000000000000000000'
    );

    const contractsDeployed = await PositionManagerFactory.positionManagers(0);
    PositionManager = (await ethers.getContractAt(PositionManagerjson['abi'], contractsDeployed)) as PositionManager;

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
    autoCompound = await AutocompoundFactory.deploy(uniswapAddressHolder.address);
    await autoCompound.deployed();

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
    //recipient: NonFungiblePositionManager - spender: liquidityProvider
    await tokenEth
      .connect(liquidityProvider)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc
      .connect(liquidityProvider)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    //recipient: positionManager - spender: user
    await tokenEth.connect(user).approve(PositionManager.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc.connect(user).approve(PositionManager.address, ethers.utils.parseEther('100000000000000'));
    //approval user to registry for test
    await registry.addNewContract(hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Test')), user.address);
    await registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('AutoCompoundModule')),
      autoCompound.address
    );

    await NonFungiblePositionManager.setApprovalForAll(PositionManager.address, true);
    //recipient: Router - spender: trader
    await tokenEth.connect(trader).approve(SwapRouter.address, ethers.utils.parseEther('1000000000000'));
    await tokenUsdc.connect(trader).approve(SwapRouter.address, ethers.utils.parseEther('1000000000000'));
    await tokenDai.connect(trader).approve(SwapRouter.address, ethers.utils.parseEther('1000000000000'));

    // give pool some liquidity
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

    const mintTx = await NonFungiblePositionManager.connect(user).mint(
      {
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 3000,
        tickLower: 0 - 60 * 10,
        tickUpper: 0 + 60 * 10,
        amount0Desired: '0x' + (1e10).toString(16),
        amount1Desired: '0x' + (1e10).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: PositionManager.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );

    const receipt: any = await mintTx.wait();
    tokenId = receipt.events[receipt.events.length - 1].args.tokenId;

    await PositionManager.pushPositionId(tokenId);

    // user approve autocompound module
    await PositionManager.toggleModule(2, autoCompound.address, true);
    // ----------------------------------------------------------------------------------------------------

    // add actions to position manager using diamond pattern
    const cut = [];
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

    cut.push({
      facetAddress: collectFeesAction.address,
      action: FacetCutAction.Add,
      functionSelectors: await getSelectors(collectFeesAction),
    });
    cut.push({
      facetAddress: increaseLiquidityAction.address,
      action: FacetCutAction.Add,
      functionSelectors: await getSelectors(increaseLiquidityAction),
    });
    cut.push({
      facetAddress: decreaseLiquidityAction.address,
      action: FacetCutAction.Add,
      functionSelectors: await getSelectors(decreaseLiquidityAction),
    });
    cut.push({
      facetAddress: updateFeesAction.address,
      action: FacetCutAction.Add,
      functionSelectors: await getSelectors(updateFeesAction),
    });

    const diamondCut = await ethers.getContractAt('IDiamondCut', PositionManager.address);

    const tx = await diamondCut.diamondCut(cut, '0x0000000000000000000000000000000000000000', []);
  });

  it('should be able not autocompound if fees are not enough', async function () {
    //do some trades to accrue fees
    for (let i = 0; i < 2; i++) {
      await SwapRouter.connect(trader).exactInputSingle([
        i % 2 === 0 ? tokenEth.address : tokenUsdc.address,
        i % 2 === 0 ? tokenUsdc.address : tokenEth.address,
        3000,
        trader.address,
        Date.now() + 1000,
        9e9,
        0,
        0,
      ]);
    }

    const position = await NonFungiblePositionManager.positions(2);
    //collect and reinvest fees
    await autoCompound.connect(user).autoCompoundFees(PositionManager.address, 2, 30);
    const positionPost = await NonFungiblePositionManager.positions(2);
    expect(positionPost.liquidity).to.lt(position.liquidity);
  });
  it('should be able to autocompound fees', async function () {
    //do some trades to accrue fees
    for (let i = 0; i < 20; i++) {
      await SwapRouter.connect(trader).exactInputSingle([
        i % 2 === 0 ? tokenEth.address : tokenUsdc.address,
        i % 2 === 0 ? tokenUsdc.address : tokenEth.address,
        3000,
        trader.address,
        Date.now() + 1000,
        9e9,
        0,
        0,
      ]);
    }

    const position = await NonFungiblePositionManager.positions(2);
    //collect and reinvest fees
    await autoCompound.connect(user).autoCompoundFees(PositionManager.address, 2, 1);
    const positionPost = await NonFungiblePositionManager.positions(2);
    expect(positionPost.liquidity).to.gt(position.liquidity);
  });

  it('should revert if position Manager does not exist', async function () {
    await expect(autoCompound.connect(user).autoCompoundFees(Factory.address, 2, 30));
  });
});