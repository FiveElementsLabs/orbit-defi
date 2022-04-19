import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ContractFactory, Contract } from 'ethers';
import { AbiCoder } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
const hre = require('hardhat');
const UniswapV3Factoryjson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');
const PositionManagerjson = require('../../artifacts/contracts/PositionManager.sol/PositionManager.json');
const LendingPooljson = require('@aave/protocol-v2/artifacts/contracts/protocol/lendingpool/LendingPool.sol/LendingPool.json');

const FixturesConst = require('../shared/fixtures');
import { tokensFixture, poolFixture, mintSTDAmount, getSelectors } from '../shared/fixtures';
import { MockToken, IUniswapV3Pool, INonfungiblePositionManager, PositionManager } from '../../typechain';

async function findbalanceSlot(MockToken: any, user: any) {
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
  let usdcMock: Contract;

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

    //deploy uniswapAddressHolder
    const uniswapAddressHolderFactory = await ethers.getContractFactory('UniswapAddressHolder');
    const uniswapAddressHolder = await uniswapAddressHolderFactory.deploy(
      Factory.address, //random address because we don't need it
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

    //Get mock token
    usdcMock = await ethers.getContractAt('MockToken', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');

    //mint some token

    const slot = await findbalanceSlot(usdcMock, user);

    const encode = (types: any, values: any) => ethers.utils.defaultAbiCoder.encode(types, values);

    let probedSlot = ethers.utils.keccak256(encode(['address', 'uint'], [user.address, slot]));
    let value = encode(['uint'], [ethers.utils.parseEther('100000000')]);

    await hre.network.provider.send('hardhat_setStorageAt', [usdcMock.address, probedSlot, value]);

    //pass to PM some token
    await usdcMock.connect(user).approve(PositionManager.address, ethers.utils.parseEther('1000000000'));
    await usdcMock.connect(user).transfer(PositionManager.address, ethers.utils.parseEther('10000000'));

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
  });

  describe('AaveDepositAction - depositToAave', function () {
    it('should deposit 10000 token to aave LendingPool', async function () {
      const balanceBefore = await usdcMock.balanceOf(PositionManager.address);

      await AaveDepositFallback.depositToAave(usdcMock.address, '10000', LendingPool.address);
      const balanceAfter = await usdcMock.balanceOf(PositionManager.address);
      const pmData = await LendingPool.getUserAccountData(PositionManager.address);
      expect(balanceAfter).to.be.lt(balanceBefore);
      expect(pmData.ltv).to.be.gt(0);
    });
  });
});
