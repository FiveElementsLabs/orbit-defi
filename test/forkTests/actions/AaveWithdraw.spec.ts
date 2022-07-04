import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ContractFactory, Contract } from 'ethers';
import { AbiCoder } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import UniswapV3Factoryjson from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json';
import PositionManagerjson from '../../../artifacts/contracts/PositionManager.sol/PositionManager.json';
import LendingPooljson from '@aave/protocol-v2/artifacts/contracts/protocol/lendingpool/LendingPool.sol/LendingPool.json';
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

describe('AaveWithdraw.sol', function () {
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
  let AaveWithdrawFallback: Contract;
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

    //mint 1e30 token, you can call with arbitrary amount
    await mintSTDAmount(tokenEth);
    await mintSTDAmount(tokenUsdc);

    //LendingPool contract
    LendingPool = await ethers.getContractAt(LendingPooljson.abi, '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9');

    //deploy uniswapAddressHolder
    const registry = (await RegistryFixture(user.address)).registryFixture;
    const uniswapAddressHolder = await deployContract('UniswapAddressHolder', [
      Factory.address, //random address because we don't need it
      Factory.address, //random address because we don't need it
      Factory.address, //random address because we don't need it
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
      ['AaveDeposit', 'AaveWithdraw']
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

    //Get mock token
    usdcMock = await ethers.getContractAt('MockToken', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    await mintForkedTokens([usdcMock], [user], 1000000000);

    //pass to PM some token
    await usdcMock.connect(user).approve(PositionManager.address, ethers.utils.parseEther('1000000000'));
    await usdcMock.connect(user).transfer(PositionManager.address, ethers.utils.parseEther('10000000'));

    AaveDepositFallback = (await ethers.getContractAt('IAaveDeposit', PositionManager.address)) as Contract;
    AaveWithdrawFallback = (await ethers.getContractAt('IAaveWithdraw', PositionManager.address)) as Contract;

    abiCoder = ethers.utils.defaultAbiCoder;
  });

  describe('AaveWithdraw - withdrawFromAave', function () {
    it('should withdraw position from aave LendingPool', async function () {
      const tx = await AaveDepositFallback.depositToAave(usdcMock.address, '5000');

      const events = (await tx.wait()).events;
      const depositEvent = events[events.length - 1];
      const id = abiCoder.decode(['address', 'uint256', 'uint256'], depositEvent.data)[1];

      await AaveDepositFallback.depositToAave(usdcMock.address, '5000');

      const balanceBefore = await usdcMock.balanceOf(PositionManager.address);
      const pmDataBefore = await LendingPool.getUserAccountData(PositionManager.address);

      await AaveWithdrawFallback.withdrawFromAave(usdcMock.address, id, 10000, false);
      const balanceAfter = await usdcMock.balanceOf(PositionManager.address);
      const pmDataAfter = await LendingPool.getUserAccountData(PositionManager.address);

      expect(balanceBefore).to.be.lt(balanceAfter);
      expect(balanceAfter.sub(balanceBefore).toNumber()).to.be.closeTo(5000, 10);
      expect(pmDataBefore.totalCollateralETH).to.be.gt(pmDataAfter.totalCollateralETH);
    });

    it('should be able to partially withdraw position from aave LendingPool', async function () {
      const tx = await AaveDepositFallback.depositToAave(usdcMock.address, '5000');

      const events = (await tx.wait()).events;
      const depositEvent = events[events.length - 1];
      const id = abiCoder.decode(['address', 'uint256', 'uint256'], depositEvent.data)[1];

      await AaveDepositFallback.depositToAave(usdcMock.address, '5000');

      const balanceBefore = await usdcMock.balanceOf(PositionManager.address);
      const pmDataBefore = await LendingPool.getUserAccountData(PositionManager.address);

      await AaveWithdrawFallback.withdrawFromAave(usdcMock.address, id, 5000, false);
      const balanceAfter = await usdcMock.balanceOf(PositionManager.address);
      const pmDataAfter = await LendingPool.getUserAccountData(PositionManager.address);

      expect(balanceBefore).to.be.lt(balanceAfter);
      expect(balanceAfter.sub(balanceBefore).toNumber()).to.be.closeTo(5000 / 2, 10);
      expect(pmDataBefore.totalCollateralETH).to.be.gt(pmDataAfter.totalCollateralETH);
    });

    it('should be able withdraw position and send it to the user', async function () {
      const tx = await AaveDepositFallback.depositToAave(usdcMock.address, '5000');

      const events = (await tx.wait()).events;
      const depositEvent = events[events.length - 1];
      const id = abiCoder.decode(['address', 'uint256', 'uint256'], depositEvent.data)[1];

      const balanceBefore = await usdcMock.balanceOf(PositionManager.address);
      const userBalanceBefore = await usdcMock.balanceOf(user.address);
      const pmDataBefore = await LendingPool.getUserAccountData(PositionManager.address);

      await AaveWithdrawFallback.withdrawFromAave(usdcMock.address, id, 10000, true);
      const balanceAfter = await usdcMock.balanceOf(PositionManager.address);
      const userBalanceAfter = await usdcMock.balanceOf(user.address);
      const pmDataAfter = await LendingPool.getUserAccountData(PositionManager.address);

      expect(balanceBefore).to.equal(balanceAfter);
      expect(userBalanceAfter.sub(userBalanceBefore).toNumber()).to.be.closeTo(5000, 10);
      expect(pmDataBefore.totalCollateralETH).to.be.gt(pmDataAfter.totalCollateralETH);
    });
  });
});
