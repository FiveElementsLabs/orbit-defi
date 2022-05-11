import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ContractFactory, Contract } from 'ethers';
import { AbiCoder, TransactionDescription } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import UniswapV3Factoryjson from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json';
import PositionManagerjson from '../../../artifacts/contracts/PositionManager.sol/PositionManager.json';
import NonFungiblePositionManagerjson from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json';
import LendingPooljson from '@aave/protocol-v2/artifacts/contracts/protocol/lendingpool/LendingPool.sol/LendingPool.json';
import SwapRouterjson from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json';
import UniswapV3Pooljson from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json';
import ATokenjson from '@aave/protocol-v2/artifacts/contracts/protocol/tokenization/AToken.sol/AToken.json';
import {
  tokensFixture,
  mintSTDAmount,
  deployContract,
  deployPositionManagerFactoryAndActions,
  mintForkedTokens,
  getPositionManager,
  doAllApprovals,
} from '../../shared/fixtures';
import { MockToken, IUniswapV3Pool, INonfungiblePositionManager, PositionManager } from '../../../typechain';

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
  let usdcMock: MockToken;
  let wbtcMock: MockToken;
  let abiCoder: AbiCoder;
  let swapRouter: Contract;
  let aUsdc: Contract;
  let tickLower: number;
  let tickUpper: number;
  let aaveId: any;

  before(async function () {
    user = await user; //owner of the smart vault, a normal user
    liquidityProvider = await liquidityProvider;
    trader = await trader;

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

    //mint 1e30 token, you can call with arbitrary amount
    await mintSTDAmount(tokenEth);
    await mintSTDAmount(tokenUsdc);

    NonFungiblePositionManager = (await ethers.getContractAtFromArtifact(
      NonFungiblePositionManagerjson,
      '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
    )) as INonfungiblePositionManager;

    Pool0 = (await ethers.getContractAtFromArtifact(
      UniswapV3Pooljson,
      '0x99ac8cA7087fA4A2A1FB6357269965A2014ABc35'
    )) as IUniswapV3Pool;

    //deploy SwapRouter
    swapRouter = await ethers.getContractAtFromArtifact(SwapRouterjson, '0xE592427A0AEce92De3Edee1F18E0157C05861564');
    //LendingPool contract
    LendingPool = await ethers.getContractAtFromArtifact(LendingPooljson, '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9');

    //deploy uniswapAddressHolder
    const uniswapAddressHolder = await deployContract('UniswapAddressHolder', [
      NonFungiblePositionManager.address,
      '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      swapRouter.address,
    ]);
    const aaveAddressHolder = await deployContract('AaveAddressHolder', [LendingPool.address]);
    const diamondCutFacet = await deployContract('DiamondCutFacet');
    const registry = await deployContract('Registry', [user.address]);
    AaveModule = await deployContract('AaveModule', [aaveAddressHolder.address, uniswapAddressHolder.address]);

    //deploy the PositionManagerFactory => deploy PositionManager
    const PositionManagerFactory = await deployPositionManagerFactoryAndActions(
      user.address,
      registry.address,
      diamondCutFacet.address,
      uniswapAddressHolder.address,
      aaveAddressHolder.address,
      [
        'AaveDeposit',
        'AaveWithdraw',
        'DecreaseLiquidity',
        'Swap',
        'SwapToPositionRatio',
        'IncreaseLiquidity',
        'CollectFees',
      ]
    );

    await registry.setPositionManagerFactory(PositionManagerFactory.address);

    await registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('AaveModule')),
      AaveModule.address
    );
    await registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Factory')),
      PositionManagerFactory.address
    );

    await registry.addNewContract(hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Test')), user.address);

    PositionManager = (await getPositionManager(PositionManagerFactory, user)) as PositionManager;

    //Get mock tokens. These need to be real Mainnet addresses
    usdcMock = (await ethers.getContractAt('MockToken', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')) as MockToken;
    wbtcMock = (await ethers.getContractAt('MockToken', '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599')) as MockToken;
    await mintForkedTokens([usdcMock, wbtcMock], [user, liquidityProvider, trader], 100000000);

    //approve NFPM
    await doAllApprovals(
      [user, liquidityProvider, trader],
      [NonFungiblePositionManager.address, swapRouter.address],
      [usdcMock, wbtcMock]
    );

    let slot0 = await Pool0.slot0();
    tickLower = (Math.round(slot0.tick / 60) - 100) * 60;
    tickUpper = (Math.round(slot0.tick / 60) + 100) * 60;
    //mint a position
    const mintTx = await NonFungiblePositionManager.connect(user).mint(
      {
        token0: wbtcMock.address,
        token1: usdcMock.address,
        fee: 3000,
        tickLower: tickLower,
        tickUpper: tickUpper,
        amount0Desired: '0x' + (1e10).toString(16),
        amount1Desired: '0x' + (1e10).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: PositionManager.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );

    //give pool some liquidity
    await NonFungiblePositionManager.connect(liquidityProvider).mint(
      {
        token0: wbtcMock.address,
        token1: usdcMock.address,
        fee: 3000,
        tickLower: (Math.round(slot0.tick / 60) - 1000) * 60,
        tickUpper: (Math.round(slot0.tick / 60) + 1000) * 60,
        amount0Desired: '0x' + (1e15).toString(16),
        amount1Desired: '0x' + (1e15).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: liquidityProvider.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );

    const receipt: any = await mintTx.wait();
    tokenId = receipt.events[receipt.events.length - 1].args.tokenId;

    // user approve AaveModule
    await PositionManager.connect(user).toggleModule(tokenId, AaveModule.address, true);
    await PositionManager.pushPositionId(tokenId);

    abiCoder = ethers.utils.defaultAbiCoder;

    const data = abiCoder.encode(['address'], [usdcMock.address]);
    await PositionManager.setModuleData(tokenId, AaveModule.address, data);

    const aUsdcAddress = (await LendingPool.getReserveData(usdcMock.address)).aTokenAddress;
    aUsdc = await ethers.getContractAtFromArtifact(ATokenjson, aUsdcAddress);
  });

  describe('AaveModule - depositToAave', function () {
    it('should not deposit to aave if position is in range', async function () {
      await AaveModule.connect(user).depositIfNeeded(PositionManager.address, tokenId);
      expect(await NonFungiblePositionManager.ownerOf(tokenId)).to.equal(PositionManager.address);
    });

    it('should deposit to aave if position is out of range', async function () {
      while ((await Pool0.slot0()).tick < tickUpper) {
        await swapRouter.connect(trader).exactInputSingle({
          tokenIn: usdcMock.address,
          tokenOut: wbtcMock.address,
          fee: 3000,
          recipient: trader.address,
          deadline: Date.now() + 1000,
          amountIn: '0x' + (1e16).toString(16),
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        });
      }

      expect((await Pool0.slot0()).tick).to.gt(tickUpper);

      const tx = await AaveModule.connect(user).depositIfNeeded(PositionManager.address, tokenId);
      const events = (await tx.wait()).events;
      aaveId = abiCoder.decode(['address', 'uint256', 'uint256'], events[events.length - 1].data)[1];
      expect(await aUsdc.balanceOf(PositionManager.address)).to.gt(0);
    });

    it('should not return to position if still out of range', async function () {
      await AaveModule.connect(user).withdrawIfNeeded(PositionManager.address, usdcMock.address, aaveId);
      expect(await aUsdc.balanceOf(PositionManager.address)).to.gt(0);
    });

    it('should retrun to position if returns in range', async function () {
      while ((await Pool0.slot0()).tick >= tickUpper) {
        await swapRouter.connect(trader).exactInputSingle({
          tokenIn: wbtcMock.address,
          tokenOut: usdcMock.address,
          fee: 3000,
          recipient: trader.address,
          deadline: Date.now() + 1000,
          amountIn: '0x' + (3e12).toString(16),
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        });
      }
      let slot0 = await Pool0.slot0();
      expect(slot0.tick).to.gt(tickLower);
      expect(slot0.tick).to.lt(tickUpper);

      const tx = await AaveModule.connect(user).withdrawIfNeeded(PositionManager.address, usdcMock.address, aaveId);
      expect(await aUsdc.balanceOf(PositionManager.address)).to.equal(0);
    });
  });
});
