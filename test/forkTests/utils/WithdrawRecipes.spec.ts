import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { Contract, ContractFactory } from 'ethers';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import LendingPooljson from '@aave/protocol-v2/artifacts/contracts/protocol/lendingpool/LendingPool.sol/LendingPool.json';
import UniswapV3Factoryjson from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json';
import UniswapV3Pooljson from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json';
import NonFungiblePositionManagerjson from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json';
import ATokenjson from '@aave/protocol-v2/artifacts/contracts/protocol/tokenization/AToken.sol/AToken.json';
import SwapRouterjson from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json';
import {
  RegistryFixture,
  deployContract,
  deployPositionManagerFactoryAndActions,
  doAllApprovals,
  getPositionManager,
  mintForkedTokens,
} from '../../shared/fixtures';
import {
  MockToken,
  INonfungiblePositionManager,
  WithdrawRecipes,
  DepositRecipes,
  PositionManager,
  MockUniswapNFTHelper,
  IUniswapV3Pool,
} from '../../../typechain';

describe('WithdrawRecipes.sol', function () {
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
  let Factory: Contract; // the factory that will deploy all pools
  let NonFungiblePositionManager: INonfungiblePositionManager; // NonFungiblePositionManager contract by UniswapV3
  let SwapRouter: Contract;
  let WithdrawRecipes: WithdrawRecipes;
  let DepositRecipes: DepositRecipes;
  let PositionManager: PositionManager;
  let PositionManagerFactory: Contract;
  let DiamondCutFacet: Contract;
  let UniswapAddressHolder: Contract;
  let registry: Contract;
  let MockUniswapNFTHelper: MockUniswapNFTHelper;
  let tokenId: any;
  let AaveModule: Contract;
  let Pool0: IUniswapV3Pool;
  let usdcMock: MockToken;
  let wbtcMock: MockToken;
  let aUsdc, aWbtc: Contract;

  before(async function () {
    user = await user; //owner of the smart vault, a normal user
    liquidityProvider = await liquidityProvider; //generic address as other users, mint pool liquidity, try to do onlyUser call etc
    trader = await trader; //trader of the smart vault, a normal user

    //deploy factory, used for pools
    Factory = await ethers.getContractAt(UniswapV3Factoryjson.abi, '0x1f98431c8ad98523631ae4a59f267346ea31f984');

    NonFungiblePositionManager = (await ethers.getContractAt(
      NonFungiblePositionManagerjson.abi,
      '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
    )) as INonfungiblePositionManager;

    Pool0 = (await ethers.getContractAt(
      UniswapV3Pooljson.abi,
      '0x99ac8cA7087fA4A2A1FB6357269965A2014ABc35'
    )) as IUniswapV3Pool;

    const SwapRouter = await ethers.getContractAt(SwapRouterjson.abi, '0xE592427A0AEce92De3Edee1F18E0157C05861564');
    const LendingPool = await ethers.getContractAt(LendingPooljson.abi, '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9');

    //deploy our contracts
    registry = (await RegistryFixture(user.address)).registryFixture;
    UniswapAddressHolder = await deployContract('UniswapAddressHolder', [
      NonFungiblePositionManager.address,
      Factory.address,
      SwapRouter.address,
      registry.address,
    ]);
    const aaveAddressHolder = await deployContract('AaveAddressHolder', [LendingPool.address, registry.address]);
    DiamondCutFacet = await deployContract('DiamondCutFacet');
    AaveModule = await deployContract('AaveModule', [
      aaveAddressHolder.address,
      UniswapAddressHolder.address,
      registry.address,
    ]);

    //deploy PositionManagerFactory
    PositionManagerFactory = await deployPositionManagerFactoryAndActions(
      user.address,
      registry.address,
      DiamondCutFacet.address,
      UniswapAddressHolder.address,
      aaveAddressHolder.address,
      [
        'ClosePosition',
        'DecreaseLiquidity',
        'CollectFees',
        'ZapOut',
        'AaveDeposit',
        'AaveWithdraw',
        'Swap',
        'SwapToPositionRatio',
        'IncreaseLiquidity',
      ]
    );

    DepositRecipes = (await deployContract('DepositRecipes', [
      UniswapAddressHolder.address,
      PositionManagerFactory.address,
    ])) as DepositRecipes;
    WithdrawRecipes = (await deployContract('WithdrawRecipes', [
      PositionManagerFactory.address,
      UniswapAddressHolder.address,
    ])) as WithdrawRecipes;

    //set registry
    await registry.setPositionManagerFactory(PositionManagerFactory.address);
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
    await registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('DepositRecipes')),
      DepositRecipes.address,
      hre.ethers.utils.formatBytes32String('1'),
      true
    );
    await registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('WithdrawRecipes')),
      WithdrawRecipes.address,
      hre.ethers.utils.formatBytes32String('1'),
      true
    );
    await registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('AaveModule')),
      AaveModule.address,
      ethers.utils.hexZeroPad(ethers.utils.hexlify(10), 32),
      true
    );
    await registry.addKeeperToWhitelist(user.address);
    PositionManager = (await getPositionManager(PositionManagerFactory, user)) as PositionManager;

    //Get mock tokens. These need to be real Mainnet addresses
    usdcMock = (await ethers.getContractAt('MockToken', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')) as MockToken;
    wbtcMock = (await ethers.getContractAt('MockToken', '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599')) as MockToken;
    await mintForkedTokens([usdcMock, wbtcMock], [user, liquidityProvider, trader], 1e15);

    //APPROVE
    await doAllApprovals(
      [user, liquidityProvider, trader],
      [NonFungiblePositionManager.address, DepositRecipes.address],
      [usdcMock, wbtcMock]
    );

    // give pools some liquidity
    await NonFungiblePositionManager.connect(liquidityProvider).mint(
      {
        token0: wbtcMock.address,
        token1: usdcMock.address,
        fee: 3000,
        tickLower: 0 - 60 * 1000,
        tickUpper: 0 + 60 * 1000,
        amount0Desired: '0x' + (1e14).toString(16),
        amount1Desired: '0x' + (1e14).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: liquidityProvider.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );

    await NonFungiblePositionManager.connect(liquidityProvider).mint(
      {
        token0: wbtcMock.address,
        token1: usdcMock.address,
        fee: 500,
        tickLower: 0 - 60 * 1000,
        tickUpper: 0 + 60 * 1000,
        amount0Desired: '0x' + (1e14).toString(16),
        amount1Desired: '0x' + (1e14).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: liquidityProvider.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );

    let MockUniswapNFTHelperFactory = await ethers.getContractFactory('MockUniswapNFTHelper');
    MockUniswapNFTHelper = (await MockUniswapNFTHelperFactory.deploy()) as MockUniswapNFTHelper;
    await MockUniswapNFTHelper.deployed();

    const aUsdcAddress = (await LendingPool.getReserveData(usdcMock.address)).aTokenAddress;
    aUsdc = await ethers.getContractAt(ATokenjson.abi, aUsdcAddress);
    const aWbtcAddress = (await LendingPool.getReserveData(wbtcMock.address)).aTokenAddress;
    aWbtc = await ethers.getContractAt(ATokenjson.abi, aWbtcAddress);

    await registry.setMaxTwapDeviation(1000000);
  });

  beforeEach(async function () {
    const mintTx = await NonFungiblePositionManager.connect(user).mint(
      {
        token0: wbtcMock.address,
        token1: usdcMock.address,
        fee: 500,
        tickLower: 0 - 60 * 1000,
        tickUpper: 0 + 60 * 1000,
        amount0Desired: '0x' + (1e10).toString(16),
        amount1Desired: '0x' + (1e10).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: user.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );

    const events: any = (await mintTx.wait()).events;
    tokenId = await events[events.length - 1].args.tokenId.toNumber();

    await NonFungiblePositionManager.connect(user).setApprovalForAll(DepositRecipes.address, true);

    await DepositRecipes.connect(user).depositUniNft([tokenId]);
  });

  describe('WithdrawRecipes.withdrawUniNft()', function () {
    it('should fully withdraw an UniNft', async function () {
      expect(await NonFungiblePositionManager.ownerOf(tokenId)).to.be.equal(PositionManager.address);
      const balanceBefore = await usdcMock.balanceOf(user.address);

      await WithdrawRecipes.connect(user).withdrawUniNft(tokenId, 10000);
      expect(await usdcMock.balanceOf(user.address)).to.be.gt(balanceBefore);
      await expect(NonFungiblePositionManager.ownerOf(tokenId)).to.be.reverted;
    });

    it('should withdraw a percentage of UniNft', async function () {
      expect(await NonFungiblePositionManager.ownerOf(tokenId)).to.be.equal(PositionManager.address);
      const balanceBefore = await usdcMock.balanceOf(user.address);
      const [amount0Before, amount1Before] = await MockUniswapNFTHelper.getAmountsfromTokenId(
        tokenId,
        NonFungiblePositionManager.address,
        await UniswapAddressHolder.uniswapV3FactoryAddress()
      );

      const percentageToWithdraw = 5000;
      await WithdrawRecipes.connect(user).withdrawUniNft(tokenId, percentageToWithdraw);

      const [amount0After, amount1After] = await MockUniswapNFTHelper.getAmountsfromTokenId(
        tokenId,
        NonFungiblePositionManager.address,
        await UniswapAddressHolder.uniswapV3FactoryAddress()
      );

      expect(amount0Before.toNumber()).to.be.closeTo(2 * amount0After.toNumber(), amount0After.toNumber() / 100);
      expect(amount1Before.toNumber()).to.be.closeTo(2 * amount1After.toNumber(), amount1After.toNumber() / 100);

      const balanceAfter = await usdcMock.balanceOf(user.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
      await expect(NonFungiblePositionManager.ownerOf(tokenId)).to.not.be.reverted;
    });

    it('should withdraw UniNft zapping out', async function () {
      expect(await NonFungiblePositionManager.ownerOf(tokenId)).to.be.equal(PositionManager.address);
      const balanceBefore = await wbtcMock.balanceOf(user.address);

      await WithdrawRecipes.connect(user).zapOutUniNft(tokenId, wbtcMock.address);
      expect(await wbtcMock.balanceOf(user.address)).to.be.gt(balanceBefore);
      await expect(NonFungiblePositionManager.ownerOf(tokenId)).to.be.reverted;
    });
    it('should revert if im not the owner of nft', async function () {
      expect(await NonFungiblePositionManager.ownerOf(tokenId)).to.be.equal(PositionManager.address);
      await expect(WithdrawRecipes.connect(liquidityProvider).withdrawUniNft(tokenId, 10000)).to.be.reverted;
    });
    it('should be able to withdraw a position idle on aave', async function () {
      expect(await NonFungiblePositionManager.ownerOf(tokenId)).to.be.equal(PositionManager.address);
      const [amount0Before, amount1Before] = await MockUniswapNFTHelper.getAmountsfromTokenId(
        tokenId,
        NonFungiblePositionManager.address,
        await UniswapAddressHolder.uniswapV3FactoryAddress()
      );
      const tokenToAave = amount0Before < amount1Before ? usdcMock : wbtcMock;
      const tx = await AaveModule.connect(user).moveToAave(PositionManager.address, tokenId);
      const events = (await tx.wait()).events;
      const aaveId = events[events.length - 1].args.aaveId;

      const balanceBefore = await tokenToAave.balanceOf(user.address);

      await WithdrawRecipes.connect(user).withdrawFromAave(aaveId, tokenToAave.address, 10000);
      expect(await tokenToAave.balanceOf(user.address)).to.be.gt(balanceBefore);
    });
  });
});
