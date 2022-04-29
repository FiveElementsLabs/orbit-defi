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
} from '../shared/fixtures';
import {
  MockToken,
  IUniswapV3Pool,
  INonfungiblePositionManager,
  TestRouter,
  DepositRecipes,
  ERC20,
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
  let Router: TestRouter; //Our router to perform swap
  let SwapRouter: Contract;
  let MintAction: Contract;
  let DecreaseLiquidityAction: Contract;
  let DecreaseLiquidityFallback: Contract;
  let AaveDepositFallback: Contract;
  let DepositRecipes: DepositRecipes;
  let LendingPool: Contract;
  let usdcMock: Contract;
  let wbtcMock: Contract;

  before(async function () {
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

    //LendingPool contract
    LendingPool = await ethers.getContractAtFromArtifact(LendingPooljson, '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9');

    //deploy uniswapAddressHolder
    const uniswapAddressHolderFactory = await ethers.getContractFactory('UniswapAddressHolder');
    const uniswapAddressHolder = await uniswapAddressHolderFactory.deploy(
      NonFungiblePositionManager.address,
      Factory.address,
      SwapRouter.address
    );
    await uniswapAddressHolder.deployed();

    //deploy aaveAddressHolder
    const aaveAddressHolderFactory = await ethers.getContractFactory('AaveAddressHolder');
    const aaveAddressHolder = await aaveAddressHolderFactory.deploy(LendingPool.address);
    await aaveAddressHolder.deployed();

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
      aaveAddressHolder.address
    );

    const contractsDeployed = await PositionManagerFactory.positionManagers(0);
    PositionManager = await ethers.getContractAt(PositionManagerjson['abi'], contractsDeployed);

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
      uniswapAddressHolder.address,
      Factory.address
    )) as DepositRecipes;
    await DepositRecipes.deployed();

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
    //approval user to registry for test
    await registry.addNewContract(hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Test')), user.address);

    //mint some tokens for user
    const slot = await findbalanceSlot(usdcMock, user);
    const encode = (types: any, values: any) => ethers.utils.defaultAbiCoder.encode(types, values);

    let probedSlot = ethers.utils.keccak256(encode(['address', 'uint'], [user.address, slot]));
    let value = encode(['uint'], [ethers.utils.parseEther('100000000')]);

    await hre.network.provider.send('hardhat_setStorageAt', [usdcMock.address, probedSlot, value]);

    //mint some tokens for liquidityProvider
    const slot2 = await findbalanceSlot(usdcMock, liquidityProvider);

    let probedSlot2 = ethers.utils.keccak256(encode(['address', 'uint'], [liquidityProvider.address, slot2]));

    await hre.network.provider.send('hardhat_setStorageAt', [usdcMock.address, probedSlot2, value]);

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
  });

  describe('PositionManager - pushAavePosition', function () {
    it('should give user shares if the first position is deposited', async function () {
      await PositionManager.pushAavePosition(usdcMock.address, 200);
      const positions = (await PositionManager.getAavePositions(usdcMock.address)) as any;
      expect(positions[0].shares).to.eq(200);
    });

    it('should give user shares if a new position is deposited', async function () {
      await AaveDepositFallback.connect(user).depositToAave(usdcMock.address, 200, LendingPool.address);
      await PositionManager.pushAavePosition(usdcMock.address, 200);
      expect(await PositionManager.aaveUserReserves(usdcMock.address)).to.equal(400);
    });

    it('should give user correct shares after accrued interest', async function () {
      const aTokenAddress = (await LendingPool.getReserveData(usdcMock.address)).aTokenAddress;
      const aUsdc = await ethers.getContractAt('MockToken', aTokenAddress);

      console.log('atoken1', await aUsdc.balanceOf(PositionManager.address));
      await usdcMock.connect(liquidityProvider).approve(LendingPool.address, 100000);
      console.log('approve');
      await LendingPool.connect(liquidityProvider).deposit(usdcMock.address, 100000, liquidityProvider.address, 0);
      console.log('deposit');
      await LendingPool.connect(liquidityProvider).borrow(usdcMock.address, 500, 2, 0, liquidityProvider.address);
      console.log('borrow');
      console.log('atoken2', await aUsdc.balanceOf(user.address));

      await ethers.provider.send('evm_mine', [Date.now() + 60]);
      console.log('mine');

      const aBalanceBefore = await aUsdc.balanceOf(user.address);
      await usdcMock.connect(user).approve(LendingPool.address, 100000);
      console.log('approve');
      await LendingPool.connect(user).deposit(usdcMock.address, 200, user.address, 0);
      console.log('deposit');
      const aBalanceAfter = await aUsdc.balanceOf(user.address);
      console.log('atokenAfter', aBalanceAfter);
      expect(aBalanceAfter).to.gt(aBalanceBefore);
      //find aToken address and check balance differece
      await PositionManager.connect(user).pushAavePosition(usdcMock.address, aBalanceAfter - aBalanceBefore);
      console.log('push');
      const positions = (await PositionManager.getAavePositions(usdcMock.address)) as any;
      console.log(positions);
      expect(positions[1].shares).to.lt(200);
    });
  });

  describe('PositionManager - removeAavePosition', function () {
    it('should correctly remove a position', async function () {
      await PositionManager.pushAavePosition(usdcMock.address, 200);
      let positions = (await PositionManager.getAavePositions(usdcMock.address)) as any;
      expect(positions[0].shares).to.eq(200);

      await PositionManager.removeAavePosition(usdcMock.address, positions[0].id);
      const positionsAfter = (await PositionManager.getAavePositions(usdcMock.address)) as any;
      expect(positionsAfter.length).to.eq(positions.length - 1);
    });
  });
});
