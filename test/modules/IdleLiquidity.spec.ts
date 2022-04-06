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

const FixturesConst = require('../shared/fixtures');
import { tokensFixture, poolFixture, mintSTDAmount, routerFixture } from '../shared/fixtures';
import { MockToken, IUniswapV3Pool, INonfungiblePositionManager, PositionManager } from '../../typechain';

describe('IdleLiquidityModule.sol', function () {
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

  let Router: Contract; //uniswapv3 router
  let Factory: Contract; // the factory that will deploy all pools
  let NonFungiblePositionManager: INonfungiblePositionManager; // NonFungiblePositionManager contract by UniswapV3
  let PositionManager: PositionManager; // Position manager contract
  let ClosePositionAction: Contract; // ClosePositionAction contract
  let MintAction: Contract; // MintAction contract
  let SwapToPositionRatioAction: Contract; // SwapToPositionRatioAction contract
  let IdleLiquidityModule: Contract; // IdleLiquidityModule contract
  let SwapRouter: Contract; // SwapRouter contract
  let abiCoder: AbiCoder; // abiCoder used to encode and decode data

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

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
    NonFungiblePositionManager = (await NonFungiblePositionManagerFactory.deploy(
      Factory.address,
      tokenEth.address,
      NonFungiblePositionManagerDescriptor.address
    )) as INonfungiblePositionManager;
    await NonFungiblePositionManager.deployed();

    //deploy swap router
    const SwapRouterFactory = new ContractFactory(SwapRouterjson['abi'], SwapRouterjson['bytecode'], user);
    SwapRouter = (await SwapRouterFactory.deploy(Factory.address, tokenEth.address)) as Contract;
    await SwapRouter.deployed();

    //deploy router
    Router = (await routerFixture()).ruoterDeployFixture;

    //deploy uniswapAddressHolder
    const uniswapAddressHolderFactory = await ethers.getContractFactory('UniswapAddressHolder');
    const uniswapAddressHolder = await uniswapAddressHolderFactory.deploy(
      NonFungiblePositionManager.address,
      Factory.address,
      SwapRouter.address
    );
    await uniswapAddressHolder.deployed();

    //deploy the PositionManagerFactory => deploy PositionManager
    const PositionManagerFactoryFactory = await ethers.getContractFactory('PositionManagerFactory');
    const PositionManagerFactory = (await PositionManagerFactoryFactory.deploy()) as Contract;
    await PositionManagerFactory.deployed();

    await PositionManagerFactory.create(user.address, uniswapAddressHolder.address);

    const contractsDeployed = await PositionManagerFactory.positionManagers(0);
    PositionManager = (await ethers.getContractAt(PositionManagerjson['abi'], contractsDeployed)) as PositionManager;

    //Deploy closePosition Action
    const closePositionActionFactory = await ethers.getContractFactory('ClosePosition');
    ClosePositionAction = (await closePositionActionFactory.deploy()) as Contract;
    await ClosePositionAction.deployed();

    //Deploy Mint Action
    const mintActionFactory = await ethers.getContractFactory('Mint');
    MintAction = (await mintActionFactory.deploy()) as Contract;
    await MintAction.deployed();

    //Deploy SwapToPositionRatio Action
    const swapToPositionRatioActionFactory = await ethers.getContractFactory('SwapToPositionRatio');
    SwapToPositionRatioAction = (await swapToPositionRatioActionFactory.deploy()) as Contract;
    await SwapToPositionRatioAction.deployed();

    //Deploy IdleLiquidityModule
    const idleLiquidityModuleFactory = await ethers.getContractFactory('IdleLiquidityModule');
    IdleLiquidityModule = (await idleLiquidityModuleFactory.deploy(uniswapAddressHolder.address)) as Contract;
    await IdleLiquidityModule.deployed();

    //get AbiCoder
    abiCoder = ethers.utils.defaultAbiCoder;

    //APPROVE
    //recipient: ClosePosition action - spender: user
    await tokenEth.connect(user).approve(ClosePositionAction.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc.connect(user).approve(ClosePositionAction.address, ethers.utils.parseEther('100000000000000'));
    //recipient: ClosePosition action - spender: user
    await tokenEth.connect(user).approve(PositionManager.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc.connect(user).approve(PositionManager.address, ethers.utils.parseEther('100000000000000'));
    //recipient: Mint action - spender: user
    await tokenEth.connect(user).approve(MintAction.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc.connect(user).approve(MintAction.address, ethers.utils.parseEther('100000000000000'));
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
    //recipient: Router - spender: liquidityProvider
    await tokenEth.connect(liquidityProvider).approve(Router.address, ethers.utils.parseEther('1000000000000'));
    await tokenUsdc.connect(liquidityProvider).approve(Router.address, ethers.utils.parseEther('1000000000000'));
    //approval nfts
    await NonFungiblePositionManager.setApprovalForAll(PositionManager.address, true);

    // give pool some liquidity
    await NonFungiblePositionManager.connect(liquidityProvider).mint(
      {
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 3000,
        tickLower: 0 - 60 * 1000,
        tickUpper: 0 + 60 * 1000,
        amount0Desired: '0x' + (1e26).toString(16),
        amount1Desired: '0x' + (1e26).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: liquidityProvider.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );
  });
  beforeEach(async function () {
    //mint NFT
    const txMint = await NonFungiblePositionManager.connect(user).mint(
      {
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 3000,
        tickLower: 0 - 60 * 2,
        tickUpper: 0 + 60 * 2,
        amount0Desired: '0x' + (1e9).toString(16),
        amount1Desired: '0x' + (1e9).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: user.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );

    const receipt: any = await txMint.wait();
    tokenId = receipt.events[receipt.events.length - 1].args.tokenId;

    await PositionManager.connect(user).depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), [tokenId]);
  });

  describe('IdleLiquidityModule - rebalance', function () {
    it('should rebalance a uni position that is out of range', async function () {
      for (let i = 0; i < 20; i++) {
        // Do a trade to change tick
        await Router.connect(liquidityProvider).swap(Pool0.address, false, '0x' + (4e23).toString(16));
      }

      const tick = (await Pool0.slot0()).tick;

      // update fees
      await PositionManager.updateUncollectedFees(tokenId);

      expect(await NonFungiblePositionManager.ownerOf(tokenId)).to.equal(PositionManager.address);
      await expect(NonFungiblePositionManager.ownerOf(tokenId.add(1))).to.be.reverted;
      expect((await NonFungiblePositionManager.positions(tokenId)).tickLower).to.be.lt(tick);
      expect((await NonFungiblePositionManager.positions(tokenId)).tickUpper).to.be.lt(tick);

      await IdleLiquidityModule.rebalance(tokenId, PositionManager.address);

      await expect(NonFungiblePositionManager.ownerOf(tokenId)).to.be.reverted;
      expect(await NonFungiblePositionManager.ownerOf(tokenId.add(1))).to.equal(PositionManager.address);
      expect((await NonFungiblePositionManager.positions(tokenId.add(1))).tickLower).to.be.lt(tick);
      expect((await NonFungiblePositionManager.positions(tokenId.add(1))).tickUpper).to.be.gt(tick);
    });

    it('should faild cause inesistent tokenId', async function () {
      try {
        await IdleLiquidityModule.rebalance(tokenId.add(1), PositionManager.address);
      } catch (error: any) {
        expect(error.message).to.include('Invalid token ID');
      }
    });
  });
});