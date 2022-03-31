import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ContractFactory, Contract } from 'ethers';
import { AbiCoder } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
const hre = require('hardhat');
const UniswapV3Factoryjson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');
const NonFungiblePositionManagerjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');
const NonFungiblePositionManagerDescriptorjson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json');
const PositionManagerjson = require('../artifacts/contracts/PositionManager.sol/PositionManager.json');
const SwapRouterjson = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json');
const FixturesConst = require('./shared/fixtures');
import { tokensFixture, poolFixture, mintSTDAmount, routerFixture } from './shared/fixtures';
import { MockToken, IUniswapV3Pool, INonfungiblePositionManager, PositionManager, TestRouter } from '../typechain';

describe('PositionManager.sol', function () {
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
  let MintAction: Contract;
  let abiCoder: AbiCoder;

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    user = await user; //owner of the smart vault, a normal user
    liquidityProvider = await liquidityProvider; //generic address as other users, mint pool liquidity, try to do onlyUser call etc
    trader = await trader; //used for swap

    //deploy first 3 token - ETH, USDC, DAI
    tokenEth = (await tokensFixture('ETH', 18)).tokenFixture;
    tokenUsdc = (await tokensFixture('USDC', 6)).tokenFixture;
    tokenDai = (await tokensFixture('DAI', 18)).tokenFixture;

    //deploy factory, used for pools
    const uniswapFactoryFactory = new ContractFactory(
      UniswapV3Factoryjson['abi'],
      UniswapV3Factoryjson['bytecode'],
      user
    );
    Factory = await uniswapFactoryFactory.deploy();
    await Factory.deployed();

    //deploy first 2 pools
    Pool0 = (await poolFixture(tokenEth, tokenUsdc, 3000, Factory)).pool;
    Pool1 = (await poolFixture(tokenEth, tokenDai, 3000, Factory)).pool;

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

    //deploy router
    const SwapRouterFactory = new ContractFactory(SwapRouterjson['abi'], SwapRouterjson['bytecode'], user);
    SwapRouter = await SwapRouterFactory.deploy(Factory.address, tokenEth.address);
    await SwapRouter.deployed();

    //deploy the PositionManagerFactory => deploy PositionManager
    const PositionManagerFactoryFactory = await ethers.getContractFactory('PositionManagerFactory');
    const PositionManagerFactory = (await PositionManagerFactoryFactory.deploy()) as Contract;
    await PositionManagerFactory.deployed();

    await PositionManagerFactory.create(user.address, NonFungiblePositionManager.address, SwapRouter.address);

    const contractsDeployed = await PositionManagerFactory.positionManagers(0);
    PositionManager = (await ethers.getContractAt(PositionManagerjson['abi'], contractsDeployed)) as PositionManager;

    //deploy an action to test
    const ActionFactory = await ethers.getContractFactory('Mint');
    MintAction = await ActionFactory.deploy(NonFungiblePositionManager.address, Factory.address);
    await MintAction.deployed();

    //select standard abicoder
    abiCoder = ethers.utils.defaultAbiCoder;

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

    const mintReceipt = (await txMint.wait()) as any;
    tokenId = mintReceipt.events[mintReceipt.events.length - 1].args.tokenId;
  });

  describe('PositionManager - depositUniNft', function () {
    it('should deposit a single UNI NFT', async function () {
      const oldOwner = await NonFungiblePositionManager.ownerOf(tokenId);

      await PositionManager.connect(user).depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), [tokenId]);

      expect(oldOwner).to.be.not.equal(await NonFungiblePositionManager.ownerOf(tokenId));
      expect(PositionManager.address).to.be.equal(await NonFungiblePositionManager.ownerOf(tokenId));
    });

    it('should deposit multiple UNI NFTs', async function () {
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

      const mintReceipt = (await txMint.wait()) as any;
      const newTokenId = mintReceipt.events[mintReceipt.events.length - 1].args.tokenId;

      await PositionManager.connect(user).depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), [
        tokenId,
        newTokenId,
      ]);

      expect(PositionManager.address).to.be.equal(await NonFungiblePositionManager.ownerOf(tokenId));
      expect(PositionManager.address).to.be.equal(await NonFungiblePositionManager.ownerOf(newTokenId));
    });
  });
  describe('PositionManager - withdrawUniNft', function () {
    it('Should withdraw a single UNI NFT', async function () {
      await PositionManager.connect(user).depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), [tokenId]);

      await PositionManager.connect(user).withdrawUniNft(user.address, tokenId);

      expect(await user.address).to.equal(await NonFungiblePositionManager.ownerOf(tokenId));
    });
    it('Should revert if token does not exist', async function () {
      let e;
      try {
        await PositionManager.connect(user).withdrawUniNft(user.address, 1000);
      } catch (error: any) {
        e = error.message;
      }

      expect(e.includes('token id not found!')).to.equal(true);
    });
  });

  describe('PositionManager - closeUniPosition', function () {
    it('Should close and burn a uniPosition', async function () {
      await PositionManager.connect(user).depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), [tokenId]);

      await PositionManager.connect(user).closeUniPositions([tokenId], true);
      let e;
      try {
        await NonFungiblePositionManager.ownerOf(tokenId);
      } catch (err: any) {
        e = err.message;
      }
      expect(e.includes('ERC721: owner query for nonexistent token')).to.equal(true);
    });
    it('Should close multiple positions with one call', async function () {
      let mintParams = [
        {
          token0: tokenEth.address,
          token1: tokenUsdc.address,
          fee: 3000,
          tickLower: 0 - 60 * 2,
          tickUpper: 0 + 60 * 2,
          amount0Desired: '0x' + (1e13).toString(16),
          amount1Desired: '0x' + (3e3).toString(16),
          amount0Min: 0,
          amount1Min: 0,
          recipient: PositionManager.address,
          deadline: Date.now(),
        },
        {
          token0: tokenEth.address,
          token1: tokenUsdc.address,
          fee: 3000,
          tickLower: 0 - 60 * 1,
          tickUpper: 0 + 60 * 1,
          amount0Desired: '0x' + (1e13).toString(16),
          amount1Desired: '0x' + (3e3).toString(16),
          amount0Min: 0,
          amount1Min: 0,
          recipient: PositionManager.address,
          deadline: Date.now(),
        },
      ];
      await PositionManager.connect(user).mintAndDeposit(mintParams, false);

      const tokens = await PositionManager._getAllUniPosition();
      const beforeBalance = await NonFungiblePositionManager.balanceOf(PositionManager.address);
      const beforeLenght = tokens.length;

      await PositionManager.connect(user).closeUniPositions([tokens[beforeLenght - 1], tokens[beforeLenght - 2]], true);

      expect(await NonFungiblePositionManager.balanceOf(PositionManager.address)).to.equal(beforeBalance.sub(2));
      expect((await PositionManager._getAllUniPosition()).length).to.be.equal(beforeLenght - 2);
    });
  });
  describe('PositionManager - collectPositionFee', function () {
    it('Should collect fees', async function () {
      await PositionManager.connect(user).depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), [tokenId]);

      // Do some trades to accrue fees
      for (let i = 0; i < 10; i++) {
        const res = await SwapRouter.connect(trader).exactInputSingle([
          i % 2 === 0 ? tokenEth.address : tokenUsdc.address,
          i % 2 === 0 ? tokenUsdc.address : tokenEth.address,
          3000,
          trader.address,
          Date.now() + 1000,
          1e15,
          0,
          0,
        ]);
      }
      // Fees are updated at every interaction with the position
      await PositionManager.connect(user).updateUncollectedFees(tokenId);

      let position = await NonFungiblePositionManager.positions(tokenId);
      expect(position.tokensOwed0).to.gt(0);
      expect(position.tokensOwed1).to.gt(0);

      await PositionManager.connect(user).collectPositionFee(tokenId, user.address);
      position = await NonFungiblePositionManager.positions(tokenId);
      expect(position.tokensOwed0).to.equal(0);
      expect(position.tokensOwed1).to.equal(0);
    });
  });
  describe('PositionManager - mintAndDeposit', function () {
    it('Should mint and deposit an uniV3 NFT', async function () {
      const tokenIds = (await PositionManager._getAllUniPosition()).length;

      await PositionManager.connect(user).mintAndDeposit(
        [
          {
            token0: tokenEth.address,
            token1: tokenUsdc.address,
            fee: 3000,
            tickLower: 0 - 60 * 1,
            tickUpper: 0 + 60 * 1,
            amount0Desired: '0x' + (1e13).toString(16),
            amount1Desired: '0x' + (3e3).toString(16),
            amount0Min: 0,
            amount1Min: 0,
            recipient: PositionManager.address,
            deadline: Date.now(),
          },
        ],
        false
      );

      expect(tokenIds).to.be.lt((await PositionManager._getAllUniPosition()).length);
    });
    it('Should mint and deposit multiple positions with one call', async function () {
      let mintParams = [
        {
          token0: tokenEth.address,
          token1: tokenUsdc.address,
          fee: 3000,
          tickLower: 0 - 60 * 2,
          tickUpper: 0 + 60 * 2,
          amount0Desired: '0x' + (1e13).toString(16),
          amount1Desired: '0x' + (3e3).toString(16),
          amount0Min: 0,
          amount1Min: 0,
          recipient: PositionManager.address,
          deadline: Date.now(),
        },
        {
          token0: tokenEth.address,
          token1: tokenUsdc.address,
          fee: 3000,
          tickLower: 0 - 60 * 1,
          tickUpper: 0 + 60 * 1,
          amount0Desired: '0x' + (1e13).toString(16),
          amount1Desired: '0x' + (3e3).toString(16),
          amount0Min: 0,
          amount1Min: 0,
          recipient: PositionManager.address,
          deadline: Date.now(),
        },
      ];

      const oldBalance = await NonFungiblePositionManager.balanceOf(PositionManager.address);
      await PositionManager.connect(user).mintAndDeposit(mintParams, false);
      expect(await NonFungiblePositionManager.balanceOf(PositionManager.address)).to.equal(oldBalance.add(2));
    });
  });
  describe('PositionManager - increasePositionLiquidity', function () {
    it('Should increase the liquidity in the NFT', async function () {
      await PositionManager.connect(user).depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), [tokenId]);
      const liquidityBefore = await Pool0.liquidity();

      await PositionManager.connect(user).increasePositionLiquidity(1, 1e10, 1e6);
      expect(await Pool0.liquidity()).to.be.gt(liquidityBefore);
    });
  });
  describe('PositionManager - decreasePositionLiquidity', function () {
    it('decrease the liquidity in the NFT', async function () {
      await PositionManager.connect(user).depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), [tokenId]);

      const tokenOwnedBefore: any = await PositionManager.connect(user).getPositionBalance(tokenId);
      const liquidityBefore: any = await NonFungiblePositionManager.positions(tokenId);

      await PositionManager.connect(user).decreasePositionLiquidity(
        tokenId,
        '0x' + (tokenOwnedBefore[0] / 2).toString(16),
        '0x' + (tokenOwnedBefore[1] / 2).toString(16)
      );

      const liquidityAfter = await NonFungiblePositionManager.positions(tokenId);
      expect(liquidityAfter.liquidity).to.be.lt(liquidityBefore.liquidity);
    });
  });
  describe('PositionManager - getPositionBalance', function () {
    it('should return the amount of token', async function () {
      await PositionManager.connect(user).depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), [tokenId]);

      const amounts = await PositionManager.getPositionBalance(tokenId);
      expect(amounts[0]).to.be.gt(0);
      expect(amounts[0]).to.be.gt(1);
    });
  });
  describe('PositionManager - OnlyUser Modifier', function () {
    it('depositUniNft', async function () {
      await expect(
        PositionManager.connect(trader).depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), [tokenId])
      ).to.be.reverted;
    });

    it('withdrawUniNft', async function () {
      await PositionManager.connect(user).depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), [tokenId]);

      await expect(PositionManager.connect(trader).withdrawUniNft(user.address, tokenId)).to.be.reverted;
    });

    it('withdrawAllUniNft', async function () {
      await PositionManager.connect(user).depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), [tokenId]);

      await expect(PositionManager.connect(trader).withdrawAllUniNft(user.address)).to.be.reverted;
    });

    it('mintAndDeposit', async function () {
      await expect(
        PositionManager.connect(trader).mintAndDeposit(
          [
            {
              token0: tokenEth.address,
              token1: tokenUsdc.address,
              fee: 3000,
              tickLower: -240000 - 60,
              tickUpper: -240000 + 60,
              amount0Desired: '0x' + (1e13).toString(16),
              amount1Desired: '0x' + (3e3).toString(16),
              amount0Min: 0,
              amount1Min: 0,
              recipient: PositionManager.address,
              deadline: Date.now(),
            },
          ],
          false
        )
      ).to.be.reverted;
    });

    it('closeUniPosition', async function () {
      await PositionManager.connect(user).depositUniNft(await NonFungiblePositionManager.ownerOf(tokenId), [tokenId]);
      await expect(PositionManager.connect(trader).closeUniPositions([tokenId], true)).to.be.reverted;
    });
  });

  describe('PositionManager - swap', function () {
    it('should correctly perform a swap', async function () {
      const balancePreUsdc = (await tokenEth.balanceOf(PositionManager.address)).toNumber();
      await PositionManager.connect(user).swap(
        tokenEth.address,
        tokenUsdc.address,
        3000,
        '0x' + (1e5).toString(16),
        false
      );
      const balancePostUsdc = (await tokenUsdc.balanceOf(PositionManager.address)).toNumber();

      expect(balancePostUsdc).to.be.closeTo(balancePreUsdc + 1e5, 5e3);
    });
  });

  describe('PositionManager - swapToPositionRatio', function () {
    it('should correctly perform a swap', async function () {
      const tx = await PositionManager.connect(user).swapToPositionRatio(
        tokenEth.address,
        tokenUsdc.address,
        3000,
        '0x' + (7e5).toString(16),
        '0x' + (1.5e5).toString(16),
        -600,
        600,
        false
      );
    });

    it('should correctly calculate the amount to swap', async function () {
      const tickPool = (await Pool0.slot0()).tick;
      let amount0Desired = 1e5;
      let amount1Desired = 2e5;
      const tickLower = -660;
      const tickUpper = 660;

      const [amountToSwap, amount0In] = await PositionManager.connect(user)._calcAmountToSwap(
        tickPool,
        tickLower,
        tickUpper,
        '0x' + amount0Desired.toString(16),
        '0x' + amount1Desired.toString(16)
      );
      const price = Math.pow(1.0001, tickPool);

      amount0Desired = Math.round(amount0Desired + (amount0In ? -1 : 1 / price) * amountToSwap.toNumber());
      amount1Desired = Math.round(amount1Desired + (amount0In ? price : -1) * amountToSwap.toNumber());

      const transaction = await PositionManager.connect(user).mintAndDeposit(
        [
          {
            token0: tokenEth.address,
            token1: tokenUsdc.address,
            fee: 3000,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: amount0Desired,
            amount1Desired: amount1Desired,
            amount0Min: 0,
            amount1Min: 0,
            recipient: PositionManager.address,
            deadline: Date.now() + 1000,
          },
        ],
        false
      );
      const positions = await PositionManager._getAllUniPosition();
      const [positionBalance0, positionBalance1] = await PositionManager.getPositionBalance(
        positions[positions.length - 1]
      );

      expect(positionBalance0.toNumber()).to.be.closeTo(amount0Desired, 5e3);
      expect(positionBalance1.toNumber()).to.be.closeTo(amount1Desired, 5e3);
    });
  });

  describe('doAction', function () {
    it('should be able to call an action', async function () {
      const tickLower = -300;
      const tickUpper = 600;
      const amount0In = 1e5;
      const amount1In = 2e5;
      const inputBytes = abiCoder.encode(
        ['address', 'address', 'uint24', 'int24', 'int24', 'uint256', 'uint256'],
        [tokenEth.address, tokenUsdc.address, 450, tickLower, tickUpper, amount0In, amount1In]
      );

      const tx = await PositionManager.connect(user).doAction(MintAction.address, inputBytes);
    });

    it('should revert if the action does not exist', async function () {
      const tickLower = -300;
      const tickUpper = 600;
      const amount0In = 1e5;
      const amount1In = 2e5;
      const inputBytes = abiCoder.encode(
        ['address', 'address', 'uint24', 'int24', 'int24', 'uint256', 'uint256'],
        [tokenEth.address, tokenUsdc.address, 450, tickLower, tickUpper, amount0In, amount1In]
      );

      const tx = await PositionManager.connect(user).doAction(Factory.address, inputBytes);
    });
  });
});
