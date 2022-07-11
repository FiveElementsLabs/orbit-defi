import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ContractFactory, Contract, BigNumber } from 'ethers';
import { AbiCoder } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import {
  tokensFixture,
  poolFixture,
  mintSTDAmount,
  RegistryFixture,
  deployUniswapContracts,
  deployContract,
  deployPositionManagerFactoryAndActions,
  getPositionManager,
  doAllApprovals,
} from '../../shared/fixtures';
import { MockToken, IUniswapV3Pool, INonfungiblePositionManager, Swap, PositionManager } from '../../../typechain';

describe('Swap.sol', function () {
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
  let PositionManager: PositionManager; // PositionManager contract by UniswapV3
  let SwapRouter: Contract; // SwapRouter contract by UniswapV3
  let SwapFallback: Contract; // Swap contract
  let abiCoder: AbiCoder;
  let UniswapAddressHolder: Contract; // address holder for UniswapV3 contracts
  let registry: Contract;

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    user = await user; //owner of the smart vault, a normal user
    liquidityProvider = await liquidityProvider;

    //deploy first 3 tokens - ETH, USDC, DAI
    tokenEth = (await tokensFixture('ETH', 18)).tokenFixture;
    tokenUsdc = (await tokensFixture('USDC', 6)).tokenFixture;
    tokenDai = (await tokensFixture('DAI', 18)).tokenFixture;

    //deploy uniswap contracts needed
    [Factory, NonFungiblePositionManager, SwapRouter] = await deployUniswapContracts(tokenEth);

    //deploy first pool
    Pool0 = (await poolFixture(tokenEth, tokenUsdc, 3000, Factory, 0)).pool;

    //mint 1e30 token, you can call with arbitrary amount
    await mintSTDAmount(tokenEth);
    await mintSTDAmount(tokenUsdc);
    await mintSTDAmount(tokenDai);

    //deploy our contracts
    registry = (await RegistryFixture(user.address)).registryFixture;
    const UniswapAddressHolder = await deployContract('UniswapAddressHolder', [
      NonFungiblePositionManager.address,
      Factory.address,
      SwapRouter.address,
      registry.address,
    ]);
    const diamondCutFacet = await deployContract('DiamondCutFacet');

    //deploy the PositionManagerFactory => deploy PositionManager
    const PositionManagerFactory = await deployPositionManagerFactoryAndActions(
      user.address,
      registry.address,
      diamondCutFacet.address,
      UniswapAddressHolder.address,
      '0x0000000000000000000000000000000000000000',
      ['Swap']
    );

    //registry setup
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

    PositionManager = (await getPositionManager(PositionManagerFactory, user)) as PositionManager;

    //get AbiCoder
    abiCoder = ethers.utils.defaultAbiCoder;

    //APPROVE
    await doAllApprovals(
      [user, liquidityProvider],
      [PositionManager.address, NonFungiblePositionManager.address],
      [tokenEth, tokenUsdc]
    );

    //give PositionManager some tokens
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

    SwapFallback = (await ethers.getContractAt('ISwap', PositionManager.address)) as Contract;
  });

  describe('Swap.sol - swap function', function () {
    it('should correctly perform a swap', async function () {
      const amount0In = 1e5;
      const amount0Before = await tokenEth.balanceOf(PositionManager.address);
      const amount1Before = await tokenUsdc.balanceOf(PositionManager.address);

      await SwapFallback.connect(user).swap(tokenEth.address, tokenUsdc.address, 3000, amount0In);
      expect(await tokenEth.balanceOf(PositionManager.address)).to.equal(amount0Before.sub(amount0In));
      expect(await tokenUsdc.balanceOf(PositionManager.address)).to.gt(amount1Before);
    });

    it('should fail to swap if twap deviation is too high', async function () {
      // 0. change maxTwapDeviation to a small value (10)
      // 1. make a big swap to change ticks by at least maxTwapDeviation
      // 2. check tick has changed after swap
      // 3. try to swap again and check that it fails for max twap deviation

      await registry.setMaxTwapDeviation(10);
      const amount0In = '0x' + (1e24).toString(16);
      const tickBefore = (await Pool0.slot0()).tick;

      // This swap should succeed
      await SwapFallback.connect(user).swap(tokenEth.address, tokenUsdc.address, 3000, amount0In);

      const tickAfter = (await Pool0.slot0()).tick;
      expect(tickAfter).to.not.be.eq(tickBefore);

      // This swap should fail because of maxTwapDeviation
      await expect(
        SwapFallback.connect(user).swap(tokenEth.address, tokenUsdc.address, 3000, amount0In)
      ).to.be.revertedWith('SwapHelper::checkDeviation: Price deviation is too high');
    });

    it('should revert if pool does not exist', async function () {
      const amount0In = 7e5;

      await expect(SwapFallback.connect(user).swap(tokenEth.address, tokenDai.address, 2348, amount0In)).to.be.reverted;
    });
  });
});
