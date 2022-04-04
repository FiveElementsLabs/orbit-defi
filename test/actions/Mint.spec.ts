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
const FixturesConst = require('../shared/fixtures');
import { tokensFixture, poolFixture, mintSTDAmount } from '../shared/fixtures';
import { MockToken, IUniswapV3Pool, INonfungiblePositionManager, PositionManager, Mint } from '../../typechain';

describe('Mint.sol', function () {
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

  let Factory: Contract; // the factory that will deploy all pools
  let NonFungiblePositionManager: INonfungiblePositionManager; // NonFungiblePositionManager contract by UniswapV3
  let MintAction: Mint;
  let abiCoder: AbiCoder;
  let PositionManager: PositionManager;

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

    //deploy uniswapAddressHolder
    const uniswapAddressHolderFactory = await ethers.getContractFactory('UniswapAddressHolder');
    const uniswapAddressHolder = await uniswapAddressHolderFactory.deploy(
      NonFungiblePositionManager.address,
      Factory.address,
      NonFungiblePositionManagerDescriptor.address //random address because we don't need it
    );
    await uniswapAddressHolder.deployed();

    //Deploy Mint Action
    const mintActionFactory = await ethers.getContractFactory('Mint');
    MintAction = (await mintActionFactory.deploy()) as Mint;
    await MintAction.deployed();

    //deploy the PositionManagerFactory => deploy PositionManager
    const PositionManagerFactoryFactory = await ethers.getContractFactory('PositionManagerFactory');
    const PositionManagerFactory = (await PositionManagerFactoryFactory.deploy()) as Contract;
    await PositionManagerFactory.deployed();

    await PositionManagerFactory.create(user.address, uniswapAddressHolder.address);

    const contractsDeployed = await PositionManagerFactory.positionManagers(0);
    PositionManager = (await ethers.getContractAt(PositionManagerjson['abi'], contractsDeployed)) as PositionManager;

    //get AbiCoder
    abiCoder = ethers.utils.defaultAbiCoder;

    //APPROVE
    //recipient: Mint action - spender: user
    await tokenEth.connect(user).approve(MintAction.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc.connect(user).approve(MintAction.address, ethers.utils.parseEther('100000000000000'));
    //recipient: NonFungiblePositionManager - spender: liquidityProvider
    await tokenEth
      .connect(liquidityProvider)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc
      .connect(liquidityProvider)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));

    //give mint action some tokens
    await tokenEth.connect(user).transfer(PositionManager.address, ethers.utils.parseEther('1000000000000'));
    await tokenUsdc.connect(user).transfer(PositionManager.address, ethers.utils.parseEther('1000000000000'));

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

  describe('doAction', function () {
    it('should correctly mint a UNIV3 position', async function () {
      const balancePre = await NonFungiblePositionManager.balanceOf(PositionManager.address);
      const amount0In = 5e5;
      const amount1In = 5e5;
      const tickLower = -720;
      const tickUpper = 3600;
      const inputBytes = abiCoder.encode(
        ['address', 'address', 'uint24', 'int24', 'int24', 'uint256', 'uint256'],
        [tokenEth.address, tokenUsdc.address, 3000, tickLower, tickUpper, amount0In, amount1In]
      );
      await PositionManager.connect(user).doAction(MintAction.address, inputBytes);

      expect(await NonFungiblePositionManager.balanceOf(PositionManager.address)).to.gt(balancePre);
    });

    it('should correctly return bytes output', async function () {
      const amount0In = 5e5;
      const amount1In = 5e5;
      const tickLower = -720;
      const tickUpper = 720;
      const inputBytes = abiCoder.encode(
        ['address', 'address', 'uint24', 'int24', 'int24', 'uint256', 'uint256'],
        [tokenEth.address, tokenUsdc.address, 3000, tickLower, tickUpper, amount0In, amount1In]
      );
      const tx = await PositionManager.connect(user).doAction(MintAction.address, inputBytes);
      const events = (await tx.wait()).events as any;

      const outputEvent = events[events.length - 1];

      const outputs = abiCoder.decode(['uint256', 'uint256', 'uint256'], outputEvent.args.data);

      expect(await outputs[0].toNumber()).to.equal(3);
      expect(await outputs[1].toNumber()).to.be.closeTo(amount0In, amount0In / 1e5);
      expect(await outputs[2].toNumber()).to.be.closeTo(amount1In, amount1In / 1e5);
    });

    it('should revert if pool does not exist', async function () {
      const amount0In = 7e5;
      const amount1In = 5e5;
      const tickLower = -720;
      const tickUpper = 720;
      const inputBytes = abiCoder.encode(
        ['address', 'address', 'uint24', 'int24', 'int24', 'uint256', 'uint256'],
        [tokenEth.address, tokenUsdc.address, 450, tickLower, tickUpper, amount0In, amount1In]
      );

      await expect(PositionManager.connect(user).doAction(MintAction.address, inputBytes)).to.be.reverted;
    });

    it('should revert if a too high/low tick is passed', async function () {
      const amount0In = 7e5;
      const amount1In = 5e5;
      const tickLower = -60;
      const tickUpper = 900000;
      const inputBytes = abiCoder.encode(
        ['address', 'address', 'uint24', 'int24', 'int24', 'uint256', 'uint256'],
        [tokenEth.address, tokenUsdc.address, 3000, tickLower, tickUpper, amount0In, amount1In]
      );

      await expect(PositionManager.connect(user).doAction(MintAction.address, inputBytes)).to.be.reverted;
    });
  });
});
