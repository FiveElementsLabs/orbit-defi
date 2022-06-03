import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ContractFactory, Contract } from 'ethers';
import { AbiCoder } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import {
  tokensFixture,
  poolFixture,
  mintSTDAmount,
  getSelectors,
  RegistryFixture,
  deployUniswapContracts,
  deployContract,
  deployPositionManagerFactoryAndActions,
  getPositionManager,
  doAllApprovals,
} from '../../shared/fixtures';
import { MockToken, IUniswapV3Pool, INonfungiblePositionManager, PositionManager, Mint } from '../../../typechain';

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
  let MintFallback: Mint;
  let abiCoder: AbiCoder;
  let PositionManager: PositionManager;
  let SwapRouter: Contract;

  before(async function () {
    await hre.network.provider.send('hardhat_reset');

    user = await user; //owner of the smart vault, a normal user
    liquidityProvider = await liquidityProvider;

    //deploy the tokens - ETH, USDC
    tokenEth = (await tokensFixture('ETH', 18)).tokenFixture;
    tokenUsdc = (await tokensFixture('USDC', 6)).tokenFixture;

    //deploy uniswap contracts needed
    [Factory, NonFungiblePositionManager, SwapRouter] = await deployUniswapContracts(tokenEth);

    //deploy first pool
    Pool0 = (await poolFixture(tokenEth, tokenUsdc, 3000, Factory)).pool;

    //mint 1e30 token, you can call with arbitrary amount
    await mintSTDAmount(tokenEth);
    await mintSTDAmount(tokenUsdc);

    //deploy our contracts
    const registry = (await RegistryFixture(user.address)).registryFixture;
    const uniswapAddressHolder = await deployContract('UniswapAddressHolder', [
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
      uniswapAddressHolder.address,
      '0x0000000000000000000000000000000000000000',
      ['Mint']
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
      [NonFungiblePositionManager.address, PositionManager.address],
      [tokenEth, tokenUsdc]
    );

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

    MintFallback = (await ethers.getContractAt('IMint', PositionManager.address)) as Mint;
  });

  describe('MintAction.sol - mint', function () {
    it('should correctly mint a UNIV3 position', async function () {
      const balancePre = await NonFungiblePositionManager.balanceOf(PositionManager.address);
      const amount0In = 5e5;
      const amount1In = 5e5;
      const tickLower = -720;
      const tickUpper = 3600;

      await MintFallback.mint({
        token0Address: tokenEth.address,
        token1Address: tokenUsdc.address,
        fee: 3000,
        tickLower: tickLower,
        tickUpper: tickUpper,
        amount0Desired: amount0In,
        amount1Desired: amount1In,
      });

      expect(await NonFungiblePositionManager.balanceOf(PositionManager.address)).to.gt(balancePre);
    });

    it('should successfully mint a UNIV3 position out of range', async function () {
      const balancePre = await NonFungiblePositionManager.balanceOf(PositionManager.address);
      const amount0In = 5e5;
      const amount1In = 5e5;
      const tickLower = -7200;
      const tickUpper = -3600;
      const tick = (await Pool0.slot0()).tick;

      expect(tickLower).to.be.lt(tick);
      expect(tickUpper).to.be.lt(tick);

      await MintFallback.mint({
        token0Address: tokenEth.address,
        token1Address: tokenUsdc.address,
        fee: 3000,
        tickLower: tickLower,
        tickUpper: tickUpper,
        amount0Desired: amount0In,
        amount1Desired: amount1In,
      });

      expect(await NonFungiblePositionManager.balanceOf(PositionManager.address)).to.gt(balancePre);
    });

    it('should revert if pool does not exist', async function () {
      const amount0In = 7e5;
      const amount1In = 5e5;
      const tickLower = -720;
      const tickUpper = 720;

      await expect(
        MintFallback.mint({
          token0Address: tokenEth.address,
          token1Address: tokenUsdc.address,
          fee: 1235132,
          tickLower: tickLower,
          tickUpper: tickUpper,
          amount0Desired: amount0In,
          amount1Desired: amount1In,
        })
      ).to.be.reverted;
    });

    it('should revert if a too high/low tick is passed', async function () {
      const amount0In = 7e5;
      const amount1In = 5e5;
      const tickLower = -60;
      const tickUpper = 900000;

      await expect(
        MintFallback.mint({
          token0Address: tokenEth.address,
          token1Address: tokenUsdc.address,
          fee: 3000,
          tickLower: tickLower,
          tickUpper: tickUpper,
          amount0Desired: amount0In,
          amount1Desired: amount1In,
        })
      ).to.be.reverted;
    });
  });
});
