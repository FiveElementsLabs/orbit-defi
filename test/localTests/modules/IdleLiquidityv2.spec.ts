import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { BigNumber, Contract } from 'ethers';
import { AbiCoder } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import {
  tokensFixture,
  poolFixture,
  mintSTDAmount,
  routerFixture,
  RegistryFixture,
  deployUniswapContracts,
  deployContract,
  deployPositionManagerFactoryAndActions,
  getPositionManager,
  doAllApprovals,
} from '../../shared/fixtures';
import { MockToken, IUniswapV3Pool, INonfungiblePositionManager, PositionManager } from '../../../typechain';

describe('IdleLiquidityModuleV2.sol', function () {
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
  let Pool0: IUniswapV3Pool, Pool1: IUniswapV3Pool;

  let Router: Contract; //uniswapv3 router
  let Factory: Contract; // the factory that will deploy all pools
  let NonFungiblePositionManager: INonfungiblePositionManager; // NonFungiblePositionManager contract by UniswapV3
  let PositionManager: PositionManager; // Position manager contract
  let ClosePositionAction: Contract; // ClosePositionAction contract
  let MintAction: Contract; // MintAction contract
  let registry: Contract;
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
    tokenDai = (await tokensFixture('DAI', 18)).tokenFixture;

    //deploy factory, used for pools
    [Factory, NonFungiblePositionManager, SwapRouter] = await deployUniswapContracts(tokenEth);
    Router = (await routerFixture()).ruoterDeployFixture;

    //deploy first pool
    Pool0 = (await poolFixture(tokenEth, tokenUsdc, 3000, Factory, 200000)).pool;
    Pool1 = (await poolFixture(tokenEth, tokenDai, 500, Factory, -50000)).pool;

    //mint 1e30 token, you can call with arbitrary amount
    await mintSTDAmount(tokenEth);
    await mintSTDAmount(tokenUsdc);
    await mintSTDAmount(tokenDai);

    //deploy our contracts
    registry = (await RegistryFixture(user.address)).registryFixture;
    const uniswapAddressHolder = await deployContract('UniswapAddressHolder', [
      NonFungiblePositionManager.address,
      Factory.address,
      SwapRouter.address,
      registry.address,
    ]);
    const diamondCutFacet = await deployContract('DiamondCutFacet');
    IdleLiquidityModule = await deployContract('IdleLiquidityModuleV2', [
      uniswapAddressHolder.address,
      registry.address,
    ]);

    //deploy the PositionManagerFactory => deploy PositionManager
    const PositionManagerFactory = await deployPositionManagerFactoryAndActions(
      user.address,
      registry.address,
      diamondCutFacet.address,
      uniswapAddressHolder.address,
      '0x0000000000000000000000000000000000000000',
      ['ClosePosition', 'Mint', 'SwapToPositionRatio']
    );

    //get AbiCoder
    abiCoder = ethers.utils.defaultAbiCoder;

    await registry.setPositionManagerFactory(PositionManagerFactory.address);
    await registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Test')),
      user.address,
      hre.ethers.utils.formatBytes32String('2'),
      true
    );
    await registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Factory')),
      PositionManagerFactory.address,
      hre.ethers.utils.formatBytes32String('2'),
      true
    );

    await registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('IdleLiquidityModuleV2')),
      IdleLiquidityModule.address,
      hre.ethers.utils.formatBytes32String('2'),
      true
    );
    await registry.addKeeperToWhitelist(user.address);

    PositionManager = (await getPositionManager(PositionManagerFactory, user)) as PositionManager;

    //APPROVE
    await doAllApprovals(
      [user, liquidityProvider],
      [PositionManager.address, NonFungiblePositionManager.address, Router.address],
      [tokenEth, tokenUsdc, tokenDai]
    );

    //approval nfts
    await NonFungiblePositionManager.setApprovalForAll(PositionManager.address, true);

    // give pool some liquidity
    await NonFungiblePositionManager.connect(liquidityProvider).mint(
      {
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 3000,
        tickLower: 0 - 60 * 10000,
        tickUpper: 0 + 60 * 10000,
        amount0Desired: '0x' + (1e26).toString(16),
        amount1Desired: '0x' + (1e26).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: liquidityProvider.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );

    await NonFungiblePositionManager.connect(liquidityProvider).mint(
      {
        token0: tokenEth.address,
        token1: tokenDai.address,
        fee: 500,
        tickLower: 0 - 60 * 10000,
        tickUpper: 0 + 60 * 10000,
        amount0Desired: '0x' + (1e26).toString(16),
        amount1Desired: '0x' + (1e26).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: liquidityProvider.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );

    await registry.setMaxTwapDeviation(1000000);
  });
  beforeEach(async function () {
    //mint NFT
    const tick = (await Pool0.slot0()).tick;
    const tickLower = Math.round(tick / 60) * 60 - 600;
    const tickUpper = Math.round(tick / 60) * 60 + 600;
    const txMint = await NonFungiblePositionManager.connect(user).mint(
      {
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 3000,
        tickLower: tickLower,
        tickUpper: tickUpper,
        amount0Desired: '0x' + (5e17).toString(16),
        amount1Desired: '0x' + (5e17).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: PositionManager.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );

    const receipt: any = await txMint.wait();
    tokenId = receipt.events[receipt.events.length - 1].args.tokenId;
    PositionManager.pushPositionId(tokenId);
    // user approve autocompound module
    await PositionManager.toggleModule(tokenId, IdleLiquidityModule.address, true);
  });

  describe('IdleLiquidityModule - rebalance', function () {
    it('should not rebalance a uni position if its still in range', async function () {
      await PositionManager.connect(user).setModuleData(
        tokenId,
        IdleLiquidityModule.address,
        abiCoder.encode(['uint24'], [2])
      );
      // rebalance
      await expect(IdleLiquidityModule.rebalance(PositionManager.address, tokenId)).to.be.revertedWith(
        'IdleLiquidityModule::rebalance: not needed.'
      );
    });

    it('should rebalance a uni position that is out of range', async function () {
      while ((await Pool0.slot0()).tick <= 206000) {
        // Do a trade to change tick
        await Router.connect(liquidityProvider).swap(Pool0.address, false, '0x' + (1e25).toString(16));
      }

      const tick = (await Pool0.slot0()).tick;

      expect(await NonFungiblePositionManager.ownerOf(tokenId)).to.equal(PositionManager.address);
      expect(Math.abs((await NonFungiblePositionManager.positions(tokenId)).tickLower)).to.be.lt(Math.abs(tick));
      expect(Math.abs((await NonFungiblePositionManager.positions(tokenId)).tickUpper)).to.be.lt(Math.abs(tick));

      await PositionManager.connect(user).setModuleData(
        tokenId,
        IdleLiquidityModule.address,
        abiCoder.encode(['uint24'], [2])
      );
      const userBalanceEth = await tokenEth.balanceOf(user.address);
      const userBalanceUsdc = await tokenUsdc.balanceOf(user.address);

      // rebalance
      await IdleLiquidityModule.rebalance(PositionManager.address, tokenId);

      await expect(NonFungiblePositionManager.ownerOf(tokenId)).to.be.reverted;
      expect(await NonFungiblePositionManager.ownerOf(tokenId.add(1))).to.equal(PositionManager.address);
      expect(Math.abs((await NonFungiblePositionManager.positions(tokenId.add(1))).tickLower)).to.be.lt(Math.abs(tick));
      expect(Math.abs((await NonFungiblePositionManager.positions(tokenId.add(1))).tickUpper)).to.be.gt(Math.abs(tick));

      const tokenEthLeftover = (await tokenEth.balanceOf(user.address)).sub(userBalanceEth);
      const tokenUsdcLeftover = (await tokenUsdc.balanceOf(user.address)).sub(userBalanceUsdc);

      const nftHelper = await deployContract('MockUniswapNFTHelper', []);
      const amounts = await nftHelper.getAmountsfromTokenId(
        tokenId.add(1),
        NonFungiblePositionManager.address,
        Factory.address
      );

      //usdc is token0 and eth is token1
      expect(tokenUsdcLeftover).to.be.closeTo(BigNumber.from(0), amounts[0].div(BigNumber.from(1000)));
      expect(tokenEthLeftover).to.be.closeTo(BigNumber.from(0), amounts[1].div(BigNumber.from(1000)));
    });

    it('should faild cause inesistent tokenId', async function () {
      await PositionManager.connect(user).setModuleData(
        tokenId,
        IdleLiquidityModule.address,
        abiCoder.encode(['uint24'], [100])
      );
      await expect(IdleLiquidityModule.rebalance(PositionManager.address, tokenId.add(1))).to.be.reverted;
    });

    it('should rebalance a uni position that is out of range (negative tick)', async function () {
      let tick = (await Pool1.slot0()).tick;
      const tickLower = Math.round(tick / 60) * 60 - 600;
      const tickUpper = Math.round(tick / 60) * 60 + 600;
      const txMint = await NonFungiblePositionManager.connect(user).mint(
        {
          token0: tokenEth.address,
          token1: tokenDai.address,
          fee: 500,
          tickLower: tickLower,
          tickUpper: tickUpper,
          amount0Desired: '0x' + (1e18).toString(16),
          amount1Desired: '0x' + (1e18).toString(16),
          amount0Min: 0,
          amount1Min: 0,
          recipient: PositionManager.address,
          deadline: Date.now() + 1000,
        },
        { gasLimit: 670000 }
      );

      const receipt: any = await txMint.wait();
      tokenId = receipt.events[receipt.events.length - 1].args.tokenId;
      PositionManager.pushPositionId(tokenId);
      // user approve autocompound module
      await PositionManager.toggleModule(tokenId, IdleLiquidityModule.address, true);

      while ((await Pool1.slot0()).tick >= -60000) {
        // Do a trade to change tick
        await Router.connect(liquidityProvider).swap(Pool1.address, true, '0x' + (1e25).toString(16));
      }

      tick = (await Pool1.slot0()).tick;

      expect(await NonFungiblePositionManager.ownerOf(tokenId)).to.equal(PositionManager.address);
      expect((await NonFungiblePositionManager.positions(tokenId)).tickLower).to.be.gt(tick);
      expect((await NonFungiblePositionManager.positions(tokenId)).tickUpper).to.be.gt(tick);
      await PositionManager.connect(user).setModuleData(
        tokenId,
        IdleLiquidityModule.address,
        abiCoder.encode(['uint24'], [2])
      );
      const userBalanceEth = await tokenEth.balanceOf(user.address);
      const userBalanceDai = await tokenDai.balanceOf(user.address);

      // rebalance
      await IdleLiquidityModule.rebalance(PositionManager.address, tokenId);

      await expect(NonFungiblePositionManager.ownerOf(tokenId)).to.be.reverted;
      expect(await NonFungiblePositionManager.ownerOf(tokenId.add(1))).to.equal(PositionManager.address);
      expect((await NonFungiblePositionManager.positions(tokenId.add(1))).tickLower).to.be.lt(tick);
      expect((await NonFungiblePositionManager.positions(tokenId.add(1))).tickUpper).to.be.gt(tick);

      const tokenEthLeftover = (await tokenEth.balanceOf(user.address)).sub(userBalanceEth);
      const tokenDaiLeftover = (await tokenDai.balanceOf(user.address)).sub(userBalanceDai);

      const nftHelper = await deployContract('MockUniswapNFTHelper', []);
      const amounts = await nftHelper.getAmountsfromTokenId(
        tokenId.add(1),
        NonFungiblePositionManager.address,
        Factory.address
      );

      //eth is token0 and dai is token1
      expect(tokenEthLeftover).to.be.closeTo(BigNumber.from(0), amounts[0].div(BigNumber.from(1000)));
      expect(tokenDaiLeftover).to.be.closeTo(BigNumber.from(0), amounts[1].div(BigNumber.from(1000)));
    });
  });
});
