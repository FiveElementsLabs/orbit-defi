import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { Contract, ContractFactory } from 'ethers';
const hre = require('hardhat');
import { ethers } from 'hardhat';
import { Test } from 'mocha';

const UniswapV3Factoryjson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');
const NonFungiblePositionManagerjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');
const NonFungiblePositionManagerDescriptorjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json');
const FixturesConst = require('../shared/fixtures');

import { MockToken, IUniswapV3Pool, INonfungiblePositionManager } from '../../typechain';
import { tokensFixture, mintSTDAmount, poolFixture } from '../shared/fixtures';

describe('TestUniswapNFTHelper', () => {
  //GLOBAL VARIABLE - USE THIS
  let signer0: any = ethers.getSigners().then(async (signers) => {
    return signers[0];
  });
  let signer1: any = ethers.getSigners().then(async (signers) => {
    return signers[1];
  });

  let owner: any;
  let spender: any;

  //all the token used globally
  let tokenEth: MockToken;
  let tokenUsdc: MockToken;

  //NFT ID
  let tokenId: any;

  //Mock contract UniswapNFTHelper
  let TestUniswapNFTHelper: Contract;

  //all the pools used globally
  let Pool0: IUniswapV3Pool;

  //Contracts deployed
  let Factory: Contract; // the factory that will deploy all pools
  let NonFungiblePositionManager: INonfungiblePositionManager; // NonFungiblePositionManager contract by UniswapV3

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    owner = await signer0;
    spender = await signer1;

    //deploy the token
    tokenEth = (await tokensFixture('ETH', 18)).tokenFixture;
    tokenUsdc = (await tokensFixture('USDC', 6)).tokenFixture;

    //mint 1e30 token, you can call with arbitrary amount
    await mintSTDAmount(tokenEth);
    await mintSTDAmount(tokenUsdc);

    //deploy factory, used for pools
    const uniswapFactoryFactory = new ContractFactory(
      UniswapV3Factoryjson['abi'],
      UniswapV3Factoryjson['bytecode'],
      owner
    );
    Factory = (await uniswapFactoryFactory.deploy()) as Contract;
    await Factory.deployed();

    //deploy pool
    Pool0 = (await poolFixture(tokenEth, tokenUsdc, 3000, Factory)).pool;

    //deploy NonFungiblePositionManagerDescriptor and NonFungiblePositionManager
    const NonFungiblePositionManagerDescriptorFactory = new ContractFactory(
      NonFungiblePositionManagerDescriptorjson['abi'],
      FixturesConst.NonFungiblePositionManagerDescriptorBytecode,
      owner
    );
    const NonFungiblePositionManagerDescriptor = await NonFungiblePositionManagerDescriptorFactory.deploy(
      tokenEth.address,
      ethers.utils.formatBytes32String('www.google.com')
    );
    await NonFungiblePositionManagerDescriptor.deployed();

    const NonFungiblePositionManagerFactory = new ContractFactory(
      NonFungiblePositionManagerjson['abi'],
      NonFungiblePositionManagerjson['bytecode'],
      owner
    );
    NonFungiblePositionManager = (await NonFungiblePositionManagerFactory.deploy(
      Factory.address,
      tokenEth.address,
      NonFungiblePositionManagerDescriptor.address
    )) as INonfungiblePositionManager;
    await NonFungiblePositionManager.deployed();

    //APPROVE
    //recipient: NonFungiblePositionManager - spender: user
    await tokenEth
      .connect(owner)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));
    await tokenUsdc
      .connect(owner)
      .approve(NonFungiblePositionManager.address, ethers.utils.parseEther('100000000000000'));

    //mint NFT
    const txMint = await NonFungiblePositionManager.connect(owner).mint(
      {
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 3000,
        tickLower: 0 - 60 * 1000,
        tickUpper: 0 + 60 * 1000,
        amount0Desired: '0x' + (1e9).toString(16),
        amount1Desired: '0x' + (1e9).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: owner.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );

    const receipt: any = await txMint.wait();
    tokenId = receipt.events[receipt.events.length - 1].args.tokenId;

    //deploy the contract
    const TestUniswapNFTHelperFactory = await ethers.getContractFactory('MockUniswapNFTHelper');
    TestUniswapNFTHelper = await TestUniswapNFTHelperFactory.deploy();
    await TestUniswapNFTHelper.deployed();
  });

  beforeEach(async function () {});

  describe('TestUniswapNFTHelper - getPool', function () {
    it('Get pool address', async function () {
      const pooladdress = await TestUniswapNFTHelper.getPool(
        Factory.address,
        tokenEth.address,
        tokenUsdc.address,
        3000
      );
      expect(pooladdress).to.equal(Pool0.address);
    });
    it('Get wrong pool address', async function () {
      const pooladdress = await TestUniswapNFTHelper.getPool(
        Factory.address,
        '0x0000000000000000000000000000000000000001',
        tokenUsdc.address,
        1200
      );
      expect(pooladdress).to.not.equal(Pool0.address);
    });
  });

  describe('TestUniswapNFTHelper - getPoolFromTokenId', function () {
    it('Get pool from token id', async function () {
      const pooladdress = await TestUniswapNFTHelper.getPoolFromTokenId(
        tokenId, //tokenId
        NonFungiblePositionManager.address, //nonFungiblepositionamanager
        Factory.address //factory
      );
      expect(pooladdress).to.equal(Pool0.address);
    });
    it('Failed to get pool from fake token id', async function () {
      expect(
        TestUniswapNFTHelper.getPoolFromTokenId(
          '2', //tokenId
          NonFungiblePositionManager.address, //nonFungiblepositionamanager
          Factory.address //factory
        )
      ).to.be.revertedWith('Invalid token ID');
    });
  });

  describe('TestUniswapNFTHelper - getTokens', function () {
    it('Get token address from tokenId', async function () {
      const tokenaddress = await TestUniswapNFTHelper.getTokens(
        tokenId, //tokenId
        NonFungiblePositionManager.address //nonFungiblepositionamanager
      );
      expect(tokenaddress.token0address).to.equal(tokenEth.address);
      expect(tokenaddress.token1address).to.equal(tokenUsdc.address);
    });
    it('Failed to get token address', async function () {
      expect(
        TestUniswapNFTHelper.getTokens(
          '2', //tokenId
          NonFungiblePositionManager.address //nonFungiblepositionamanager
        )
      ).to.be.revertedWith('Invalid token ID');
    });
  });

  describe('TestUniswapNFTHelper - getAmountsFromLiquidity', function () {
    it('Get liquidity for amounts', async function () {
      const liquidityBefore = '167175499835819766';
      const liquidity = await TestUniswapNFTHelper.getAmountsFromLiquidity(liquidityBefore, -120, 120, Pool0.address);
      expect(liquidity[0].toString()).to.equal('999999999999999');
      expect(liquidity[1].toString()).to.equal('999999999999999');
    });
  });

  describe('TestUniswapNFTHelper - getLiquidityFromAmounts', function () {
    it('Get amounts for liquidity', async function () {
      const token0Dep = '1000000000000000';
      const token1Dep = '1000000000000000';
      const liquidity = await TestUniswapNFTHelper.getLiquidityFromAmounts(
        token0Dep,
        token1Dep,
        -120,
        120,
        Pool0.address
      );
      expect(liquidity.toString()).to.equal('167175499835819766');
    });
  });
});
