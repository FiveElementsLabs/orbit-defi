import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ContractFactory, Contract } from 'ethers';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import UniswapV3Factoryjson from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json';
import NonFungiblePositionManagerjson from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json';
import NonFungiblePositionManagerDescriptorjson from '@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json';
import PositionManagerjson from '../../artifacts/contracts/PositionManager.sol/PositionManager.json';
import SwapRouterjson from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json';
import LendingPooljson from '@aave/protocol-v2/artifacts/contracts/protocol/lendingpool/LendingPool.sol/LendingPool.json';
import {
  NonFungiblePositionManagerDescriptorBytecode,
  tokensFixture,
  poolFixture,
  mintSTDAmount,
  getSelectors,
  findbalanceSlot,
  RegistryFixture,
  getPositionManager,
  deployUniswapContracts,
  deployPositionManagerFactoryAndActions,
  mintForkedTokens,
  deployContract,
} from '../shared/fixtures';
import {
  MockToken,
  IUniswapV3Pool,
  INonfungiblePositionManager,
  TestRouter,
  DepositRecipes,
  PositionManagerFactory,
} from '../../typechain';

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
  let PositionManager: Contract; //Our smart vault named PositionManager
  let SwapRouter: Contract;
  let MintAction: Contract;
  let DecreaseLiquidityAction: Contract;
  let DecreaseLiquidityFallback: Contract;
  let AaveDepositFallback: Contract;
  let DepositRecipes: DepositRecipes;
  let LendingPool: Contract;
  let usdcMock: Contract;
  let wbtcMock: Contract;
  let Registry: Contract;
  let UniswapAddressHolder: Contract;
  let AaveAddressHolder: Contract;
  let DiamondCutFacet: Contract;

  before(async function () {
    user = await user; //owner of the smart vault, a normal user
    liquidityProvider = await liquidityProvider; //generic address as other users, mint pool liquidity, try to do onlyUser call etc
    trader = await trader; //used for swap

    //deploy first 3 token - ETH, USDC, DAI
    tokenEth = (await tokensFixture('ETH', 18)).tokenFixture;
    tokenUsdc = (await tokensFixture('USDC', 6)).tokenFixture;
    tokenDai = (await tokensFixture('DAI', 18)).tokenFixture;

    //deploy uniswap contracts needed
    [Factory, NonFungiblePositionManager, SwapRouter] = await deployUniswapContracts(tokenEth);

    //deploy first 2 pools
    Pool0 = (await poolFixture(tokenEth, tokenUsdc, 3000, Factory)).pool;
    Pool1 = (await poolFixture(tokenEth, tokenDai, 3000, Factory)).pool;

    //mint 1e30 token, you can call with arbitrary amount
    await mintSTDAmount(tokenEth);
    await mintSTDAmount(tokenUsdc);
    await mintSTDAmount(tokenDai);

    //LendingPool contract
    LendingPool = await ethers.getContractAtFromArtifact(LendingPooljson, '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9');

    //deploy our contracts
    Registry = await deployContract('Registry', [user.address]);
    UniswapAddressHolder = await deployContract('UniswapAddressHolder', [
      NonFungiblePositionManager.address,
      Factory.address,
      SwapRouter.address,
      Registry.address,
    ]);
    AaveAddressHolder = await deployContract('AaveAddressHolder', [LendingPool.address, Registry.address]);
    DiamondCutFacet = await deployContract('DiamondCutFacet');

    //deploy the PositionManagerFactory => deploy PositionManager
    const PositionManagerFactory = await deployPositionManagerFactoryAndActions(
      user.address,
      Registry.address,
      DiamondCutFacet.address,
      UniswapAddressHolder.address,
      AaveAddressHolder.address,
      ['ClosePosition']
    );

    await Registry.setPositionManagerFactory(PositionManagerFactory.address);
    await Registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Test')),
      user.address,
      hre.ethers.utils.formatBytes32String('1'),
      true
    );
    await Registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Factory')),
      PositionManagerFactory.address,
      hre.ethers.utils.formatBytes32String('1'),
      true
    );

    PositionManager = await getPositionManager(PositionManagerFactory, user);
    await Registry.setPositionManagerFactory(user.address);

    //deploy an action to test
    const ActionFactory = await ethers.getContractFactory('Mint');
    MintAction = await ActionFactory.deploy();
    await MintAction.deployed();

    //Deploy DecreaseLiquidity Action
    const DecreaseLiquidityActionFactory = await ethers.getContractFactory('DecreaseLiquidity');
    DecreaseLiquidityAction = (await DecreaseLiquidityActionFactory.deploy()) as Contract;
    await DecreaseLiquidityAction.deployed();

    //deploy depositRecipes
    const DepositRecipesFactory = await ethers.getContractFactory('DepositRecipes');
    DepositRecipes = (await DepositRecipesFactory.deploy(
      UniswapAddressHolder.address,
      Factory.address
    )) as DepositRecipes;

    //Deploy Aave Deposit Action
    const AaveDepositActionFactory = await ethers.getContractFactory('AaveDeposit');
    const AaveDepositAction = (await AaveDepositActionFactory.deploy()) as Contract;
    await AaveDepositAction.deployed();

    //Get mock token
    usdcMock = await ethers.getContractAt('MockToken', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    wbtcMock = await ethers.getContractAt('MockToken', '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599');

    //APPROVE
    //recipient: Router - spender: trader
    await tokenEth.connect(trader).approve(SwapRouter.address, ethers.utils.parseEther('1000000000000'));
    await tokenUsdc.connect(trader).approve(SwapRouter.address, ethers.utils.parseEther('1000000000000'));
    await tokenDai.connect(trader).approve(SwapRouter.address, ethers.utils.parseEther('1000000000000'));

    //mint some tokens for user
    await mintForkedTokens([usdcMock], [user, liquidityProvider], [100000000]);

    //pass to PM some token
    await usdcMock.connect(user).approve(PositionManager.address, ethers.utils.parseEther('100000000'));
    await usdcMock.connect(user).transfer(PositionManager.address, ethers.utils.parseEther('10000000'));

    const cut = [];
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

    cut.push({
      facetAddress: AaveDepositAction.address,
      action: FacetCutAction.Add,
      functionSelectors: await getSelectors(AaveDepositAction),
    });

    const diamondCut = await ethers.getContractAt('IDiamondCut', PositionManager.address);

    await diamondCut.diamondCut(cut, '0x0000000000000000000000000000000000000000', []);
    AaveDepositFallback = await ethers.getContractAt('IAaveDeposit', PositionManager.address);
  });

  describe('PositionManager - DiamondCut', function () {
    it('should add a new action and call it', async function () {
      // add actions to position manager using diamond cut
      const cut = [];
      const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

      cut.push({
        facetAddress: DecreaseLiquidityAction.address,
        action: FacetCutAction.Add,
        functionSelectors: await getSelectors(DecreaseLiquidityAction),
      });

      const diamondCut = await ethers.getContractAt('IDiamondCut', PositionManager.address);

      await diamondCut.diamondCut(cut, '0x0000000000000000000000000000000000000000', []);

      DecreaseLiquidityFallback = await ethers.getContractAt('IDecreaseLiquidity', PositionManager.address);
    });

    it('should revert if replace a wrong one function address', async function () {
      // add actions to position manager using diamond cut
      const cut = [];
      const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

      cut.push({
        facetAddress: MintAction.address,
        action: FacetCutAction.Replace,
        functionSelectors: await getSelectors(DecreaseLiquidityAction),
      });

      const diamondCut = await ethers.getContractAt('IDiamondCut', PositionManager.address);

      await diamondCut.diamondCut(cut, '0x0000000000000000000000000000000000000000', []);

      DecreaseLiquidityFallback = await ethers.getContractAt('IDecreaseLiquidity', PositionManager.address);

      const amount0Desired = 1e4;
      const amount1Desired = 1e6;

      await expect(DecreaseLiquidityFallback.connect(user).decreaseLiquidity(tokenId, amount0Desired, amount1Desired))
        .to.be.reverted;
    });

    it('should replace onefunction address', async function () {
      // add actions to position manager using diamond cut
      const cut = [];
      const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

      cut.push({
        facetAddress: DecreaseLiquidityAction.address,
        action: FacetCutAction.Replace,
        functionSelectors: await getSelectors(DecreaseLiquidityAction),
      });

      const diamondCut = await ethers.getContractAt('IDiamondCut', PositionManager.address);

      await diamondCut.diamondCut(cut, '0x0000000000000000000000000000000000000000', []);

      DecreaseLiquidityFallback = await ethers.getContractAt('IDecreaseLiquidity', PositionManager.address);
    });

    it('should remove onefunction address', async function () {
      // add actions to position manager using diamond cut
      const cut = [];
      const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

      cut.push({
        facetAddress: '0x0000000000000000000000000000000000000000',
        action: FacetCutAction.Remove,
        functionSelectors: await getSelectors(DecreaseLiquidityAction),
      });

      const diamondCut = await ethers.getContractAt('IDiamondCut', PositionManager.address);

      await diamondCut.diamondCut(cut, '0x0000000000000000000000000000000000000000', []);
      DecreaseLiquidityFallback = await ethers.getContractAt('IDecreaseLiquidity', PositionManager.address);

      const amount0Desired = 1e4;
      const amount1Desired = 1e6;

      await expect(DecreaseLiquidityFallback.connect(user).decreaseLiquidity(tokenId, amount0Desired, amount1Desired))
        .to.be.reverted;
    });
    it('should fail if another user try to add one action', async function () {
      // add actions to position manager using diamond cut
      const cut = [];
      const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

      cut.push({
        facetAddress: DecreaseLiquidityAction.address,
        action: FacetCutAction.Add,
        functionSelectors: await getSelectors(DecreaseLiquidityAction),
      });

      const diamondCut = await ethers.getContractAt('IDiamondCut', PositionManager.address);

      await diamondCut.diamondCut(cut, '0x0000000000000000000000000000000000000000', []);

      DecreaseLiquidityFallback = await ethers.getContractAt('IDecreaseLiquidity', PositionManager.address);

      const amount0Desired = 1e4;
      const amount1Desired = 1e6;

      await expect(
        DecreaseLiquidityFallback.connect(liquidityProvider).decreaseLiquidity(tokenId, amount0Desired, amount1Desired)
      ).to.be.reverted;
    });
  });

  describe('PositionManager - onlyFactory', function () {
    it('should revert if not called by factory', async function () {
      await expect(
        PositionManager.connect(liquidityProvider).init(
          user.address,
          UniswapAddressHolder.address,
          AaveAddressHolder.address
        )
      ).to.be.reverted;
    });
  });
});
