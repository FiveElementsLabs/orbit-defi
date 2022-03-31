import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ContractFactory, Contract } from 'ethers';
const UniswapV3Factoryjson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');
const NonFungiblePositionManagerjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');
const NonFungiblePositionManagerDescriptorjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json');
const PositionManagerjson = require('../../artifacts/contracts/PositionManager.sol/PositionManager.json');
const SwapRouterjson = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json');
const FixturesConst = require('../shared/fixtures');
const hre = require('hardhat');
import { AbiCoder } from 'ethers/lib/utils';

import { ethers } from 'hardhat';
import { tokensFixture, poolFixture, mintSTDAmount, routerFixture } from '../shared/fixtures';

import {
  MockToken,
  IUniswapV3Pool,
  INonfungiblePositionManager,
  PositionManager,
  TestRouter,
  SwapToPositionRatio,
  UniswapAddressHolder,
} from '../../typechain';

describe('SwapToPositionRatio.sol', function () {
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
  let NonFungiblePositionManager: INonfungiblePositionManager; // NonFungiblePositionManager contract by UniswapV3
  let PositionManager: PositionManager; //Our smart vault named PositionManager
  let Router: TestRouter; //Our router to perform swap
  let SwapRouter: Contract;
  let SwapToPositionRatioAction: SwapToPositionRatio;
  let abiCoder: AbiCoder;
  let UniswapAddressHolder: UniswapAddressHolder;

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    user = await user; //owner of the smart vault, a normal user
    liquidityProvider = await liquidityProvider; //generic address as other users, mint pool liquidity, try to do onlyUser call etc
    trader = await trader; //used for swap

    //deploy first 3 token - ETH, USDC, DAI
    tokenEth = await tokensFixture('ETH', 18).then((tokenFix) => tokenFix.tokenFixture);
    tokenUsdc = await tokensFixture('USDC', 6).then((tokenFix) => tokenFix.tokenFixture);
    tokenDai = await tokensFixture('DAI', 18).then((tokenFix) => tokenFix.tokenFixture);

    //deploy factory, used for pools
    const uniswapFactoryFactory = new ContractFactory(
      UniswapV3Factoryjson['abi'],
      UniswapV3Factoryjson['bytecode'],
      user
    );
    Factory = (await uniswapFactoryFactory.deploy().then((contract) => contract.deployed())) as Contract;

    //deploy first 2 pools
    Pool0 = await poolFixture(tokenEth, tokenUsdc, 3000, Factory).then((poolFix) => poolFix.pool);
    Pool1 = await poolFixture(tokenEth, tokenDai, 3000, Factory).then((poolFix) => poolFix.pool);

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
    ).then((contract) => contract.deployed());

    const NonFungiblePositionManagerFactory = new ContractFactory(
      NonFungiblePositionManagerjson['abi'],
      NonFungiblePositionManagerjson['bytecode'],
      user
    );
    NonFungiblePositionManager = (await NonFungiblePositionManagerFactory.deploy(
      Factory.address,
      tokenEth.address,
      NonFungiblePositionManagerDescriptor.address
    ).then((contract) => contract.deployed())) as INonfungiblePositionManager;

    //deploy router
    const SwapRouterFactory = new ContractFactory(SwapRouterjson['abi'], SwapRouterjson['bytecode'], user);
    //Router = await routerFixture().then((RFixture) => RFixture.ruoterDeployFixture);
    SwapRouter = (await SwapRouterFactory.deploy(Factory.address, tokenEth.address).then((contract) =>
      contract.deployed()
    )) as Contract;

    //deploy UniswapAddressHolder
    const UniswapAddressHolderFactory = await ethers.getContractFactory('UniswapAddressHolder');
    UniswapAddressHolder = (await UniswapAddressHolderFactory.deploy(
      NonFungiblePositionManager.address,
      Factory.address,
      SwapRouter.address
    )) as UniswapAddressHolder;

    //deploy the PositionManagerFactory => deploy PositionManager
    const PositionManagerFactory = await ethers
      .getContractFactory('PositionManagerFactory')
      .then((contract) => contract.deploy().then((deploy) => deploy.deployed()));

    console.log('Uniswapaddressholder test - ', UniswapAddressHolder.address);
    await PositionManagerFactory.create(
      user.address,
      NonFungiblePositionManager.address,
      SwapRouter.address,
      UniswapAddressHolder.address
    );

    const contractsDeployed = await PositionManagerFactory.positionManagers(0);
    PositionManager = (await ethers.getContractAt(PositionManagerjson['abi'], contractsDeployed)) as PositionManager;

    //Deploy Swap Action
    const SwapToPositionRatioActionFactory = await ethers.getContractFactory('SwapToPositionRatio');
    SwapToPositionRatioAction = (await SwapToPositionRatioActionFactory.deploy(
      UniswapAddressHolder.address
    )) as SwapToPositionRatio;
    await SwapToPositionRatioAction.deployed();

    //Set addresses in Address Holder helper
    await UniswapAddressHolder.setFactoryAddress(Factory.address);
    await UniswapAddressHolder.setSwapRouterAddress(SwapRouter.address);
    await UniswapAddressHolder.setNonFungibleAddress(NonFungiblePositionManager.address);

    //get AbiCoder
    abiCoder = ethers.utils.defaultAbiCoder;

    console.log('factory: ', SwapRouter.address);

    //APPROVE
    //recipient: NonFungiblePositionManager - spender: user
    await tokenEth
      .connect(user)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc
      .connect(user)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    await tokenDai
      .connect(user)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    //recipient: NonFungiblePositionManager - spender: liquidityProvider
    await tokenEth
      .connect(liquidityProvider)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc
      .connect(liquidityProvider)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    await tokenDai
      .connect(liquidityProvider)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    //recipient: PositionManager - spender: user
    await tokenEth.connect(user).approve(PositionManager.address, ethers.utils.parseEther('1000000000000'));
    await tokenUsdc.connect(user).approve(PositionManager.address, ethers.utils.parseEther('1000000000000'));
    await tokenDai.connect(user).approve(PositionManager.address, ethers.utils.parseEther('1000000000000'));
    //recipient: Router - spender: trader
    await tokenEth.connect(trader).approve(SwapRouter.address, ethers.utils.parseEther('1000000000000'));
    await tokenUsdc.connect(trader).approve(SwapRouter.address, ethers.utils.parseEther('1000000000000'));
    await tokenDai.connect(trader).approve(SwapRouter.address, ethers.utils.parseEther('1000000000000'));
    //recipient: Pool0 - spender: trader
    await tokenEth.connect(trader).approve(Pool0.address, ethers.utils.parseEther('1000000000000'));
    await tokenUsdc.connect(trader).approve(Pool0.address, ethers.utils.parseEther('1000000000000'));
    await tokenDai.connect(trader).approve(Pool0.address, ethers.utils.parseEther('1000000000000'));
    //recipient: Pool0 - spender: user
    await tokenEth.connect(user).approve(Pool0.address, ethers.utils.parseEther('1000000000000'));
    await tokenUsdc.connect(user).approve(Pool0.address, ethers.utils.parseEther('1000000000000'));
    await tokenDai.connect(user).approve(Pool0.address, ethers.utils.parseEther('1000000000000'));
    //recipient: SwapToPositionRatioAction - spender: user
    await tokenEth.connect(user).approve(SwapToPositionRatioAction.address, ethers.utils.parseEther('1000000000000'));
    await tokenUsdc.connect(user).approve(SwapToPositionRatioAction.address, ethers.utils.parseEther('1000000000000'));

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
    const txMint = await NonFungiblePositionManager.connect(user).mint(
      {
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 3000,
        tickLower: 0 - 60 * 1000,
        tickUpper: 0 + 60 * 1000,
        amount0Desired: '0x' + (1e18).toString(16),
        amount1Desired: '0x' + (1e18).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: user.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );
  });

  /*   describe('doAction', function () {
    it('should correctly swap to optimal ratio for the position', async function () {
      const balancePre = await NonFungiblePositionManager.balanceOf(user.address);
      const amount0In = 5e5;
      const amount1In = 5e5;
      const tickLower = -720;
      const tickUpper = 3600;
      const inputBytes = abiCoder.encode(
        ['address', 'address', 'uint24', 'uint256', 'uint256', 'int24', 'int24'],
        [tokenEth.address, tokenUsdc.address, 3000, amount0In, amount1In, tickLower, tickUpper]
      );

      const events = (await (await SwapToPositionRatioAction.connect(user).doAction(inputBytes)).wait()).events;

      console.log(await NonFungiblePositionManager.balanceOf(user.address));
      // expect(await NonFungiblePositionManager.balanceOf(user.address)).to.gt(balancePre);
    });

    it('should correctly return bytes output', async function () {
      const amount0In = 5e5;
      const amount1In = 5e5;
      const tickLower = -720;
      const tickUpper = 720;
      const inputBytes = abiCoder.encode(
        ['address', 'address', 'uint24', 'uint256', 'uint256', 'int24', 'int24'],
        [tokenEth.address, tokenUsdc.address, 3000, amount0In, amount1In, tickLower, tickUpper]
      );

      const events = (await (await SwapToPositionRatioAction.connect(user).doAction(inputBytes)).wait()).events as any;

      const outputEvent = events[events.length - 1];

      const outputs = abiCoder.decode(['uint256'], outputEvent.args[0]);

      expect(await outputs[0].toNumber()).to.equal(5);
    });
  }); */

  describe('doAction', function () {
    it('should be able to call an action', async function () {
      const tickLower = -300;
      const tickUpper = 600;
      const amount0In = 1e5;
      const amount1In = 2e5;
      const inputBytes = abiCoder.encode(
        ['address', 'address', 'uint24', 'uint256', 'uint256', 'int24', 'int24'],
        [tokenEth.address, tokenUsdc.address, 3000, amount0In, amount1In, tickLower, tickUpper]
      );

      console.log('ETH ADDY: ', tokenEth.address);
      console.log('USDC ADDY: ', tokenUsdc.address);

      await tokenEth.connect(user).transfer(PositionManager.address, 3e5);
      await tokenUsdc.connect(user).transfer(PositionManager.address, 3e5);
      console.log('User: ', user.address);
      console.log('PositionManager: ', PositionManager.address);
      console.log('SwaptoPosition: ', SwapToPositionRatioAction.address);
      const amount1InBytes = await PositionManager.connect(user).delegateAction(
        tokenEth.address,
        tokenUsdc.address,
        SwapToPositionRatioAction.address,
        inputBytes
      );
    });

    // it('should revert if the action does not exist', async function () {
    //   const tickLower = -300;
    //   const tickUpper = 600;
    //   const amount0In = 1e5;
    //   const amount1In = 2e5;
    //   const inputBytes = abiCoder.encode(
    //     ['address', 'address', 'uint24', 'uint256', 'uint256', 'int24', 'int24'],
    //     [tokenEth.address, tokenUsdc.address, 3000, amount0In, amount1In, tickLower, tickUpper]
    //   );

    //   await expect(PositionManager.connect(user).delegateAction(Factory.address, inputBytes)).to.be.reverted;
    // });
  });
});
