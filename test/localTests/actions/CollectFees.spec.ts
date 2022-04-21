import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ContractFactory, Contract } from 'ethers';
import { AbiCoder } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import UniswapV3Factoryjson from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json';
import NonFungiblePositionManagerjson from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json';
import NonFungiblePositionManagerDescriptorjson from '@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json';
import PositionManagerjson from '../../../artifacts/contracts/PositionManager.sol/PositionManager.json';
import SwapRouterjson from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json';
import {
  NonFungiblePositionManagerDescriptorBytecode,
  tokensFixture,
  poolFixture,
  mintSTDAmount,
  getSelectors,
} from '../../shared/fixtures';
import { MockToken, IUniswapV3Pool, INonfungiblePositionManager, PositionManager } from '../../../typechain';

describe('CollectFees.sol', function () {
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
  let Pool0: IUniswapV3Pool;

  let Factory: Contract; // the factory that will deploy all pools
  let NonFungiblePositionManager: INonfungiblePositionManager; // NonFungiblePositionManager contract by UniswapV3
  let collectFees: Contract; // collectFees contract
  let abiCoder: AbiCoder;
  let PositionManager: PositionManager;
  let swapRouter: Contract;
  let MintFallback: Contract; //Mint contract

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    user = await user; //owner of the smart vault, a normal user
    liquidityProvider = await liquidityProvider; //liquidity provider for the pool
    trader = await trader; //who executes trades

    //deploy first 3 token - ETH, USDC, DAI
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

    //deploy SwapRouter
    const SwapRouterFactory = new ContractFactory(SwapRouterjson['abi'], SwapRouterjson['bytecode'], user);
    swapRouter = await SwapRouterFactory.deploy(Factory.address, tokenEth.address);
    await swapRouter.deployed();

    //deploy uniswapAddressHolder
    const uniswapAddressHolderFactory = await ethers.getContractFactory('UniswapAddressHolder');
    const uniswapAddressHolder = await uniswapAddressHolderFactory.deploy(
      NonFungiblePositionManager.address,
      Factory.address,
      swapRouter.address
    );
    await uniswapAddressHolder.deployed();

    //deploy Mint action
    const MintFactory = await ethers.getContractFactory('Mint');
    const mintAction = await MintFactory.deploy();
    await mintAction.deployed();

    //deploy CollectFees action
    const CollectFeesFactory = await ethers.getContractFactory('CollectFees');
    const collectFeesAction = await CollectFeesFactory.deploy();
    await collectFeesAction.deployed();

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
      '0x0000000000000000000000000000000000000000'
    );

    const contractsDeployed = await PositionManagerFactory.positionManagers(0);
    PositionManager = (await ethers.getContractAt(PositionManagerjson['abi'], contractsDeployed)) as PositionManager;

    //get AbiCoder
    abiCoder = ethers.utils.defaultAbiCoder;

    //APPROVE
    //recipient: PositionManager - spender: user
    await tokenEth.connect(user).approve(PositionManager.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc.connect(user).approve(PositionManager.address, ethers.utils.parseEther('100000000000000'));
    //recipient: NonFungiblePositionManager - spender: liquidityProvider
    await tokenEth
      .connect(liquidityProvider)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc
      .connect(liquidityProvider)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    //recipient: Router - spender: trader
    await tokenEth.connect(trader).approve(swapRouter.address, ethers.utils.parseEther('1000000000000'));
    await tokenUsdc.connect(trader).approve(swapRouter.address, ethers.utils.parseEther('1000000000000'));
    //approval user to registry for test
    await registry.addNewContract(hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Test')), user.address);

    // give pool some liquidity
    await NonFungiblePositionManager.connect(liquidityProvider).mint(
      {
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 3000,
        tickLower: 0 - 60 * 1000,
        tickUpper: 0 + 60 * 1000,
        amount0Desired: '0x' + (1e5).toString(16),
        amount1Desired: '0x' + (1e5).toString(16),
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
      facetAddress: mintAction.address,
      action: FacetCutAction.Add,
      functionSelectors: await getSelectors(mintAction),
    });

    cut.push({
      facetAddress: collectFeesAction.address,
      action: FacetCutAction.Add,
      functionSelectors: await getSelectors(collectFeesAction),
    });

    const diamondCut = await ethers.getContractAt('IDiamondCut', PositionManager.address);

    await diamondCut.diamondCut(cut, '0x0000000000000000000000000000000000000000', []);

    MintFallback = await ethers.getContractAt('IMint', PositionManager.address);
    collectFees = await ethers.getContractAt('ICollectFees', PositionManager.address);
  });

  describe('CollectFees.collectFees()', function () {
    it('should collect fees', async function () {
      const fee = 3000;
      const tickLower = -720;
      const tickUpper = 720;
      const amount0In = 5e5;
      const amount1In = 5e5;

      //give positionManager some funds
      await tokenEth.connect(user).transfer(PositionManager.address, 6e5);
      await tokenUsdc.connect(user).transfer(PositionManager.address, 6e5);

      //mint a position
      let tx = await MintFallback.connect(user).mint({
        token0Address: tokenEth.address,
        token1Address: tokenUsdc.address,
        fee: fee,
        tickLower: tickLower,
        tickUpper: tickUpper,
        amount0Desired: amount0In,
        amount1Desired: amount1In,
      });
      let events = (await tx.wait()).events as any;

      const mintEvent = events[events.length - 1];
      const tokenId = mintEvent.data;

      // Do some trades to accrue fees
      for (let i = 0; i < 10; i++) {
        await swapRouter
          .connect(trader)
          .exactInputSingle([
            i % 2 === 0 ? tokenEth.address : tokenUsdc.address,
            i % 2 === 0 ? tokenUsdc.address : tokenEth.address,
            3000,
            trader.address,
            Date.now() + 1000,
            1e4,
            0,
            0,
          ]);
      }

      // collect fees
      tx = await collectFees.connect(user).collectFees(tokenId);
      events = (await tx.wait()).events as any;
      const collectEvent = events[events.length - 1];
      const feesCollected = abiCoder.decode(['uint256', 'uint256'], collectEvent.data);

      expect(feesCollected[0]).to.gt(0);
      expect(feesCollected[1]).to.gt(0);
    });

    it('should revert if position does not exist', async function () {
      await expect(collectFees.connect(user).collectFees(200)).to.be.reverted;
    });

    it('should revert if position is not owned by user', async function () {
      await expect(collectFees.connect(user).collectFees(1)).to.be.reverted;
    });
  });
});
