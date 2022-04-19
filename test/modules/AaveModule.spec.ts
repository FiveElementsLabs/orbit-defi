import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ContractFactory, Contract } from 'ethers';
import { AbiCoder } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
const hre = require('hardhat');
const UniswapV3Factoryjson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');
const NonFungiblePositionManagerjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');
const NonFungiblePositionManagerDescriptorjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json');
const PositionManagerjson = require('../../artifacts/contracts/PositionManager.sol/PositionManager.json');

const SwapRouterjson = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json');

const IERC20 = require('../../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json');
const UniswapV3Pool = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json');

//aave json
const LendingPooljson = require('@aave/protocol-v2/artifacts/contracts/protocol/lendingpool/LendingPool.sol/LendingPool.json');
const LendingPoolConfigurationjson = require('@aave/protocol-v2/artifacts/contracts/protocol/lendingpool/LendingPoolConfigurator.sol/LendingPoolConfigurator.json');
const LendingPoolAddressProviderjson = require('@aave/protocol-v2/artifacts/contracts/protocol/configuration/LendingPoolAddressesProvider.sol/LendingPoolAddressesProvider.json');
const DefaultReserveInterestRateStrategyjson = require('@aave/protocol-v2/artifacts/contracts/protocol/lendingpool/DefaultReserveInterestRateStrategy.sol/DefaultReserveInterestRateStrategy.json');
const ReserveLogicjson = require('@aave/protocol-v2/artifacts/contracts/protocol/libraries/logic/ReserveLogic.sol/ReserveLogic.json');
const ValidationLogicjson = require('@aave/protocol-v2/artifacts/contracts/protocol/libraries/logic/ValidationLogic.sol/ValidationLogic.json');
const GenericLogicjson = require('@aave/protocol-v2/artifacts/contracts/protocol/libraries/logic/GenericLogic.sol/GenericLogic.json');
const ATokenjson = require('@aave/protocol-v2/artifacts/contracts/protocol/tokenization/AToken.sol/AToken.json');
const StableDebtTokenjson = require('@aave/protocol-v2/artifacts/contracts/protocol/tokenization/StableDebtToken.sol/StableDebtToken.json');
const VariableDebtTokenjson = require('@aave/protocol-v2/artifacts/contracts/protocol/tokenization/VariableDebtToken.sol/VariableDebtToken.json');

const FixturesConst = require('../shared/fixtures');
import { tokensFixture, poolFixture, mintSTDAmount, routerFixture, getSelectors } from '../shared/fixtures';
import {
  MockToken,
  IUniswapV3Pool,
  INonfungiblePositionManager,
  PositionManager,
  TestRouter,
  AutoCompoundModule,
} from '../../typechain';

describe('AaveModule.sol', function () {
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
  let NonFungiblePositionManager: Contract; // NonFungiblePositionManager contract by UniswapV3
  let PositionManager: Contract; //Our smart vault named PositionManager
  let Router: TestRouter; //Our router to perform swap
  let SwapRouter: Contract;
  let collectFeesAction: Contract;
  let increaseLiquidityAction: Contract;
  let decreaseLiquidityAction: Contract;
  let updateFeesAction: Contract;
  let autoCompound: Contract;
  let LendingPool: Contract;
  let AaveModule: Contract;
  let usdcMock: Contract;
  let ethMock: Contract;
  let abiCoder: AbiCoder;

  before(async function () {
    //await hre.network.provider.send('hardhat_reset');
    await hre.network.provider.send('evm_setAutomine', [true]);

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

    NonFungiblePositionManager = await ethers.getContractAtFromArtifact(
      NonFungiblePositionManagerjson,
      '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
    );

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
    autoCompound = await AutocompoundFactory.deploy(uniswapAddressHolder.address, 100);
    await autoCompound.deployed();

    //------------------------------------------------------------------------------------------------------------------------------------------------------------

    LendingPool = await ethers.getContractAtFromArtifact(LendingPooljson, '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9');

    const AaveModuleFactory = await ethers.getContractFactory('AaveModule');
    AaveModule = await AaveModuleFactory.deploy(LendingPool.address);
    await AaveModule.deployed();

    //select standard abicoder
    abiCoder = ethers.utils.defaultAbiCoder;

    usdcMock = await ethers.getContractAt('MockToken', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');

    async function findbalanceSlot(MockToken: any) {
      const encode = (types: any, values: any) => ethers.utils.defaultAbiCoder.encode(types, values);
      const account = user.address;
      const probeA = encode(['uint'], [10]);
      const probeB = encode(['uint'], [2]);
      for (let i = 0; i < 100; i++) {
        let probedSlot = ethers.utils.keccak256(encode(['address', 'uint'], [account, i]));
        // remove padding for JSON RPC
        while (probedSlot.startsWith('0x0')) probedSlot = '0x' + probedSlot.slice(3);
        const prev = await hre.network.provider.send('eth_getStorageAt', [MockToken.address, probedSlot, 'latest']);
        // make sure the probe will change the slot value
        const probe = prev === probeA ? probeB : probeA;

        await hre.network.provider.send('hardhat_setStorageAt', [MockToken.address, probedSlot, probe]);

        const balance = await MockToken.balanceOf(account);
        // reset to previous value
        if (!balance.eq(ethers.BigNumber.from(probe)))
          await hre.network.provider.send('hardhat_setStorageAt', [MockToken.address, probedSlot, prev]);
        if (balance.eq(ethers.BigNumber.from(probe))) return i;
      }
    }

    const slot = await findbalanceSlot(usdcMock);

    const encode = (types: any, values: any) => ethers.utils.defaultAbiCoder.encode(types, values);

    let probedSlot = ethers.utils.keccak256(encode(['address', 'uint'], [user.address, slot]));
    let value = encode(['uint'], [ethers.utils.parseEther('1000')]);

    await hre.network.provider.send('hardhat_setStorageAt', [usdcMock.address, probedSlot, value]);

    //----------------------------------------------------------------
    ethMock = await ethers.getContractAt('MockToken', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');

    const slotEth = await findbalanceSlot(ethMock);

    let probedSlotEth = ethers.utils.keccak256(encode(['address', 'uint'], [user.address, slotEth]));
    let valueEth = encode(['uint'], [ethers.utils.parseEther('1000')]);

    await hre.network.provider.send('hardhat_setStorageAt', [ethMock.address, probedSlotEth, valueEth]);

    await usdcMock.connect(user).approve(LendingPool.address, ethers.utils.parseEther('1000000000'));
    await ethMock.connect(user).approve(LendingPool.address, ethers.utils.parseEther('1000000000'));
    const balanceAfter = await usdcMock.connect(user).balanceOf(user.address);
    const allowance = await usdcMock.connect(user).allowance(user.address, LendingPool.address);

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

    await NonFungiblePositionManager.setApprovalForAll(PositionManager.address, true);
    //recipient: Router - spender: trader
    await tokenEth.connect(trader).approve(SwapRouter.address, ethers.utils.parseEther('1000000000000'));
    await tokenUsdc.connect(trader).approve(SwapRouter.address, ethers.utils.parseEther('1000000000000'));
    await tokenDai.connect(trader).approve(SwapRouter.address, ethers.utils.parseEther('1000000000000'));

    const poolUsdcEth = await ethers.getContractAtFromArtifact(
      UniswapV3Pool,
      '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8'
    );
  });
  it('should deposit some token', async function () {
    const before = await LendingPool.getUserAccountData(user.address);

    const balanceBefore = await ethMock.balanceOf(user.address);

    ethMock.connect(user).transfer(AaveModule.address, '100000');
    await ethMock.approve(AaveModule.address, ethers.utils.parseEther('1000000000000000'));
    await AaveModule.depositToAave(ethMock.address);

    await AaveModule.withdrawToAave(ethMock.address);
  });
});
