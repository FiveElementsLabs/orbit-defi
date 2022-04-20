import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ContractFactory, Contract, BigNumber } from 'ethers';
import { AbiCoder } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
const hre = require('hardhat');
const UniswapV3Factoryjson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');
const NonFungiblePositionManagerjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');
const NonFungiblePositionManagerDescriptorjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json');
const PositionManagerjson = require('../../artifacts/contracts/PositionManager.sol/PositionManager.json');
const SwapRouterjson = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json');
const FixturesConst = require('../shared/fixtures');
import { tokensFixture, poolFixture, mintSTDAmount, getSelectors } from '../shared/fixtures';
import {
  MockToken,
  IUniswapV3Pool,
  INonfungiblePositionManager,
  IncreaseLiquidity,
  PositionManager,
} from '../../typechain';

describe('IncreaseLiquidity.sol', function () {
  //GLOBAL VARIABLE - USE THIS
  let user: any = ethers.getSigners().then(async (signers) => {
    return signers[0];
  });
  let liquidityProvider: any = ethers.getSigners().then(async (signers) => {
    return signers[1];
  });

  //all the token used globally
  let tokenEth: MockToken, tokenUsdc: MockToken, tokenDai: MockToken;

  //all the pools used globally
  let Pool0: IUniswapV3Pool;

  // the NFT tokenId used for tests
  let tokenId: any;

  let Factory: Contract; // the factory that will deploy all pools
  let NonFungiblePositionManager: INonfungiblePositionManager; // NonFungiblePositionManager contract by UniswapV3
  let PositionManager: PositionManager; // PositionManager contract by UniswapV3
  let SwapRouter: Contract; // SwapRouter contract by UniswapV3
  let IncreaseLiquidityFallback: Contract; // IncreaseLiquidity contract
  let abiCoder: AbiCoder;
  let UniswapAddressHolder: Contract; // address holder for UniswapV3 contracts

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    user = await user; //owner of the smart vault, a normal user
    liquidityProvider = await liquidityProvider;

    //deploy first 3 tokens - ETH, USDC, DAI
    tokenEth = (await tokensFixture('ETH', 18)).tokenFixture;
    tokenUsdc = (await tokensFixture('USDC', 6)).tokenFixture;
    tokenDai = (await tokensFixture('DAI', 18)).tokenFixture;

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

    //deploy uniswapAddressHolder
    const UniswapAddressHolderFactory = await ethers.getContractFactory('UniswapAddressHolder');
    UniswapAddressHolder = (await UniswapAddressHolderFactory.deploy(
      NonFungiblePositionManager.address,
      Factory.address,
      SwapRouter.address
    )) as Contract;
    await UniswapAddressHolder.deployed();

    // deploy DiamondCutFacet ----------------------------------------------------------------------
    const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet');
    const diamondCutFacet = await DiamondCutFacet.deploy();
    await diamondCutFacet.deployed();

    // deploy Registry
    const Registry = await ethers.getContractFactory('Registry');
    const registry = await Registry.deploy(user.address);
    await registry.deployed();

    //deploy the PositionManagerFactory => deploy PositionManager
    const PositionManagerFactory = await ethers
      .getContractFactory('PositionManagerFactory')
      .then((contract) => contract.deploy().then((deploy) => deploy.deployed()));

    await PositionManagerFactory.create(
      user.address,
      diamondCutFacet.address,
      UniswapAddressHolder.address,
      registry.address,
      '0x0000000000000000000000000000000000000000'
    );

    const contractsDeployed = await PositionManagerFactory.positionManagers(0);
    PositionManager = (await ethers.getContractAt(PositionManagerjson['abi'], contractsDeployed)) as PositionManager;

    //Deploy IncreaseLiquidity Action
    const IncreaseLiquidityActionFactory = await ethers.getContractFactory('IncreaseLiquidity');
    const IncreaseLiquidityAction = (await IncreaseLiquidityActionFactory.deploy()) as IncreaseLiquidity;
    await IncreaseLiquidityAction.deployed();

    //get AbiCoder
    abiCoder = ethers.utils.defaultAbiCoder;

    //APPROVE
    //recipient: IncreaseLiquidity action - spender: user
    await tokenEth.connect(user).approve(IncreaseLiquidityAction.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc.connect(user).approve(IncreaseLiquidityAction.address, ethers.utils.parseEther('100000000000000'));
    //recipient: NonFungiblePositionManager - spender: liquidityProvider
    await tokenEth
      .connect(liquidityProvider)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc
      .connect(liquidityProvider)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    //recipient: NonFungiblePositionManager - spender: user
    await tokenEth
      .connect(user)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc
      .connect(user)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    //recipient: PositionManager - spender: user
    await tokenEth.connect(user).approve(PositionManager.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc.connect(user).approve(PositionManager.address, ethers.utils.parseEther('100000000000000'));
    //approval user to registry for test
    await registry.addNewContract(hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Test')), user.address);

    //give PositionManager some tokens
    await tokenEth.connect(user).transfer(PositionManager.address, ethers.utils.parseEther('10000000'));
    await tokenUsdc.connect(user).transfer(PositionManager.address, ethers.utils.parseEther('10000000'));

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

    // add actions to position manager using diamond cut
    const cut = [];
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

    cut.push({
      facetAddress: IncreaseLiquidityAction.address,
      action: FacetCutAction.Add,
      functionSelectors: await getSelectors(IncreaseLiquidityAction),
    });

    const diamondCut = await ethers.getContractAt('IDiamondCut', PositionManager.address);

    await diamondCut.diamondCut(cut, '0x0000000000000000000000000000000000000000', []);

    IncreaseLiquidityFallback = await ethers.getContractAt('IIncreaseLiquidity', PositionManager.address);
  });

  // Mint a liquidity position for the user in order to test the action.
  beforeEach(async function () {
    const txMint = await NonFungiblePositionManager.connect(user).mint(
      {
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 3000,
        tickLower: 0 - 60 * 1000,
        tickUpper: 0 + 60 * 1000,
        amount0Desired: '0x' + (1e10).toString(16),
        amount1Desired: '0x' + (1e10).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: PositionManager.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );

    const mintReceipt = (await txMint.wait()) as any;
    tokenId = mintReceipt.events[mintReceipt.events.length - 1].args.tokenId;
    await PositionManager.pushPositionId(tokenId);
  });

  describe('IncreaseLiquidity.increaseLiquidity()', function () {
    it('should correctly perform the add liquidity action', async function () {
      const poolTokenId = 1;
      const liquidityBefore = (await NonFungiblePositionManager.positions(poolTokenId)).liquidity;

      const amount0Desired = 1e4;
      const amount1Desired = 1e6;

      const tx = await IncreaseLiquidityFallback.connect(user).increaseLiquidity(
        poolTokenId,
        amount0Desired,
        amount1Desired
      );

      expect((await NonFungiblePositionManager.positions(poolTokenId)).liquidity).to.gt(liquidityBefore);
    });

    it('should correctly add liquidity to the NFT position', async function () {
      const liquidityBefore = await Pool0.liquidity();

      const poolTokenId = 1;
      const amount0Desired = 1e4;
      const amount1Desired = 1e6;
      const inputBytes = abiCoder.encode(
        ['uint256', 'uint256', 'uint256'],
        [poolTokenId, amount0Desired, amount1Desired]
      );

      const tx = await IncreaseLiquidityFallback.connect(user).increaseLiquidity(
        poolTokenId,
        amount0Desired,
        amount1Desired
      );

      const events = await tx.wait();
      expect(await Pool0.liquidity()).to.be.gt(liquidityBefore);
    });

    it('should revert if no tokens are sent', async function () {
      const poolTokenId = 1;
      const amount0Desired = 0;
      const amount1Desired = 0;

      await expect(
        IncreaseLiquidityFallback.connect(user).increaseLiquidity(poolTokenId, amount0Desired, amount1Desired)
      ).to.be.reverted;
    });

    it('should revert if the pool does not exist', async function () {
      const poolTokenId = 30;
      const amount0Desired = 1e4;
      const amount1Desired = 1e6;

      await expect(
        IncreaseLiquidityFallback.connect(user).increaseLiquidity(poolTokenId, amount0Desired, amount1Desired)
      ).to.be.reverted;
    });
  });
});
