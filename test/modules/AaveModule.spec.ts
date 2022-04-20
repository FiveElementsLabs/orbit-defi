import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ContractFactory, Contract } from 'ethers';
import { AbiCoder } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
const hre = require('hardhat');
const UniswapV3Factoryjson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');
const PositionManagerjson = require('../../artifacts/contracts/PositionManager.sol/PositionManager.json');
const NonFungiblePositionManagerjson = require('@uniswap/v3-periphery/artifacts/contracts/NonFungiblePositionManager.sol/NonFungiblePositionManager.json');
const LendingPooljson = require('@aave/protocol-v2/artifacts/contracts/protocol/lendingpool/LendingPool.sol/LendingPool.json');

const FixturesConst = require('../shared/fixtures');
import { tokensFixture, poolFixture, mintSTDAmount, getSelectors, findbalanceSlot } from '../shared/fixtures';
import { MockToken, IUniswapV3Pool, INonfungiblePositionManager, PositionManager } from '../../typechain';

describe('AaveDeposit.sol', function () {
  //GLOBAL VARIABLE - USE THIS
  let user: any = ethers.getSigners().then(async (signers) => {
    return signers[0];
  });
  let liquidityProvider: any = ethers.getSigners().then(async (signers) => {
    return signers[1];
  });

  //all the token used globally
  let tokenEth: MockToken, tokenUsdc: MockToken, tokenDai: MockToken;

  //token used after mint
  let tokenId: any;

  //all the pools used globally
  let Pool0: IUniswapV3Pool;

  let Factory: Contract; // the factory that will deploy all pools
  let NonFungiblePositionManager: INonfungiblePositionManager; // NonFungiblePositionManager contract by UniswapV3
  let PositionManager: PositionManager; // Position manager contract
  let AaveDepositFallback: Contract;
  let LendingPool: Contract;
  let AaveModule: Contract;
  let usdcMock: Contract;
  let wbtcMock: Contract;

  before(async function () {
    user = await user; //owner of the smart vault, a normal user
    liquidityProvider = await liquidityProvider;

    //deploy the tokens - ETH, USDC
    tokenEth = (await tokensFixture('ETH', 18)).tokenFixture;
    tokenUsdc = (await tokensFixture('USDC', 6)).tokenFixture;

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
    await mintSTDAmount(tokenEth);
    await mintSTDAmount(tokenUsdc);

    NonFungiblePositionManager = (await ethers.getContractAtFromArtifact(
      NonFungiblePositionManagerjson,
      '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
    )) as INonfungiblePositionManager;

    //deploy uniswapAddressHolder
    const uniswapAddressHolderFactory = await ethers.getContractFactory('UniswapAddressHolder');
    const uniswapAddressHolder = await uniswapAddressHolderFactory.deploy(
      NonFungiblePositionManager.address, //random address because we don't need it
      Factory.address, //random address because we don't need it
      Factory.address //random address because we don't need it
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
      registry.address
    );

    const contractsDeployed = await PositionManagerFactory.positionManagers(0);
    PositionManager = (await ethers.getContractAt(PositionManagerjson['abi'], contractsDeployed)) as PositionManager;

    //Deploy Aave Deposit Action
    const AaveDepositActionFactory = await ethers.getContractFactory('AaveDeposit');
    const AaveDepositAction = (await AaveDepositActionFactory.deploy()) as Contract;
    await AaveDepositAction.deployed();

    //LendingPool contract
    LendingPool = await ethers.getContractAtFromArtifact(LendingPooljson, '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9');

    const AaveModuleFactory = await ethers.getContractFactory('AaveModule');
    AaveModule = await AaveModuleFactory.deploy(LendingPool.address, uniswapAddressHolder.address);
    await AaveModule.deployed();

    console.log('Aave module', AaveModule);

    //Get mock token
    usdcMock = await ethers.getContractAt('MockToken', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    wbtcMock = await ethers.getContractAt('MockToken', '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599');

    //mint some wbtc

    let slot = await findbalanceSlot(wbtcMock, user);

    let encode = (types: any, values: any) => ethers.utils.defaultAbiCoder.encode(types, values);

    let probedSlot = ethers.utils.keccak256(encode(['address', 'uint'], [user.address, slot]));
    let value = encode(['uint'], [ethers.utils.parseEther('100000000')]);

    await hre.network.provider.send('hardhat_setStorageAt', [wbtcMock.address, probedSlot, value]);

    //mint some usdc
    slot = await findbalanceSlot(usdcMock, user);

    encode = (types: any, values: any) => ethers.utils.defaultAbiCoder.encode(types, values);

    probedSlot = ethers.utils.keccak256(encode(['address', 'uint'], [user.address, slot]));
    value = encode(['uint'], [ethers.utils.parseEther('100000000')]);

    await hre.network.provider.send('hardhat_setStorageAt', [usdcMock.address, probedSlot, value]);

    console.log('balance usdc', await usdcMock.balanceOf(user.address));
    console.log('balance wbtc', await wbtcMock.balanceOf(user.address));
    //approve nfpm
    await usdcMock.connect(user).approve(NonFungiblePositionManager.address, ethers.utils.parseEther('1000000000'));
    await wbtcMock.connect(user).approve(NonFungiblePositionManager.address, ethers.utils.parseEther('1000000000'));
    console.log('pre registry');
    //approval user to registry for test
    await registry.addNewContract(hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Test')), user.address);

    // add actions to position manager using diamond pattern
    const cut = [];
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

    cut.push({
      facetAddress: AaveDepositAction.address,
      action: FacetCutAction.Add,
      functionSelectors: await getSelectors(AaveDepositAction),
    });

    const diamondCut = await ethers.getContractAt('IDiamondCut', PositionManager.address);
    const tx = await diamondCut.diamondCut(cut, '0x0000000000000000000000000000000000000000', []);
    AaveDepositFallback = (await ethers.getContractAt('IAaveDeposit', PositionManager.address)) as Contract;

    //mint a position
    const mintTx = await NonFungiblePositionManager.connect(user).mint(
      {
        token0: wbtcMock.address,
        token1: usdcMock.address,
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
    console.log('Minted: tokenId: ', tokenId?.toNumber());

    await PositionManager.pushPositionId(tokenId);
  });

  describe('AaveModule - depositToAave', function () {
    it('should deposit token in position out of range', async function () {
      AaveModule.depositToAave(PositionManager.address, tokenId, 1);
    });
  });
});
