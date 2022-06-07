import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ContractFactory, Contract } from 'ethers';
import { AbiCoder } from 'ethers/lib/utils';
import hre, { ethers } from 'hardhat';
import UniswapV3Factoryjson from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json';
import LendingPooljson from '@aave/protocol-v2/artifacts/contracts/protocol/lendingpool/LendingPool.sol/LendingPool.json';
import ATokenjson from '@aave/protocol-v2/artifacts/contracts/protocol/tokenization/AToken.sol/AToken.json';
import {
  tokensFixture,
  poolFixture,
  mintSTDAmount,
  deployContract,
  deployPositionManagerFactoryAndActions,
  mintForkedTokens,
  getPositionManager,
  RegistryFixture,
} from '../../shared/fixtures';
import { MockToken, IUniswapV3Pool, INonfungiblePositionManager, PositionManager } from '../../../typechain';

describe('AaveDeposit.sol', function () {
  //GLOBAL VARIABLE - USE THIS
  let user: any = ethers.getSigners().then(async (signers) => {
    return signers[0];
  });
  let liquidityProvider: any = ethers.getSigners().then(async (signers) => {
    return signers[1];
  });

  let tokenEth: MockToken, tokenUsdc: MockToken; //all the token used globally
  let Pool0: IUniswapV3Pool; //all the pools used globally
  let Factory: Contract; // the factory that will deploy all pools
  let PositionManager: PositionManager; // Position manager contract
  let AaveDepositFallback: Contract;
  let LendingPool: Contract;
  let usdcMock: Contract;
  let abiCoder: AbiCoder;

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
    //LendingPool contract
    LendingPool = await ethers.getContractAt(LendingPooljson.abi, '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9');

    //mint 1e30 token, you can call with arbitrary amount
    await mintSTDAmount(tokenEth);
    await mintSTDAmount(tokenUsdc);

    //deploy our contracts
    const registry = (await RegistryFixture(user.address)).registryFixture;
    const uniswapAddressHolder = await deployContract('UniswapAddressHolder', [
      Factory.address, //random address because we don't need it
      Factory.address, //random address because we don't need it
      Factory.address, //random address because we don't need it,
      registry.address,
    ]);
    const aaveAddressHolder = await deployContract('AaveAddressHolder', [LendingPool.address, registry.address]);
    const diamondCutFacet = await deployContract('DiamondCutFacet');

    //deploy the PositionManagerFactory => deploy PositionManager
    const PositionManagerFactory = await deployPositionManagerFactoryAndActions(
      user.address,
      registry.address,
      diamondCutFacet.address,
      uniswapAddressHolder.address,
      aaveAddressHolder.address,
      ['AaveDeposit']
    );
    await registry.setPositionManagerFactory(PositionManagerFactory.address);

    //approval user to registry for test
    await registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Test')),
      user.address,
      hre.ethers.utils.formatBytes32String('1'),
      true
    );
    await registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Factory')),
      PositionManagerFactory.address,
      hre.ethers.utils.formatBytes32String('1'),
      true
    );

    PositionManager = (await getPositionManager(PositionManagerFactory, user)) as PositionManager;
    AaveDepositFallback = (await ethers.getContractAt('IAaveDeposit', PositionManager.address)) as Contract;

    //Get mock token
    usdcMock = await ethers.getContractAt('MockToken', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    await mintForkedTokens([usdcMock], [user], 1000000000);

    //pass to PM some token
    await usdcMock.connect(user).approve(PositionManager.address, ethers.utils.parseEther('1000000000'));
    await usdcMock.connect(user).transfer(PositionManager.address, ethers.utils.parseEther('10000000'));

    abiCoder = ethers.utils.defaultAbiCoder;
  });

  describe('AaveDepositAction - depositToAave', function () {
    it('should deposit to aave and correctly update position manager', async function () {
      await usdcMock.connect(user).approve(AaveDepositFallback.address, 10000);
      await usdcMock.connect(user).transfer(AaveDepositFallback.address, 10000);

      const tx = await AaveDepositFallback.connect(user).depositToAave(usdcMock.address, 10000);

      const aUsdcAddress = (await LendingPool.getReserveData(usdcMock.address)).aTokenAddress;
      const aUsdc = await ethers.getContractAt(ATokenjson.abi, aUsdcAddress);
      expect((await aUsdc.balanceOf(PositionManager.address)).toNumber()).to.be.closeTo(10000, 10);

      const events = (await tx.wait()).events;
      const depositEvent = events[events.length - 1];
      const [, id, shares] = abiCoder.decode(['address', 'uint256', 'uint256'], depositEvent.data);

      expect(id).to.equal(0);
      expect(shares.toNumber()).to.be.closeTo(9309, 50);
    });
  });
});
