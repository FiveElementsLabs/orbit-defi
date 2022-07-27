import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { Contract } from 'ethers';
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
import {
  MockToken,
  IUniswapV3Pool,
  INonfungiblePositionManager,
  PositionManager,
  TestRouter,
  AutoCompoundModule,
} from '../../../typechain';

describe('AutoCompoundModule.sol', function () {
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

  //tokenId used globally on all test
  let tokenId: any;

  let Factory: Contract; // the factory that will deploy all pools
  let NonFungiblePositionManager: INonfungiblePositionManager; // NonFungiblePositionManager contract by UniswapV3
  let PositionManager: PositionManager; //Our smart vault named PositionManager
  let SwapRouter: Contract;
  let autoCompound: Contract;
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
    [Factory, NonFungiblePositionManager, SwapRouter] = await deployUniswapContracts(tokenEth);

    //deploy first 2 pools
    const Pool0 = (await poolFixture(tokenEth, tokenUsdc, 3000, Factory, 0)).pool;
    const Pool1 = (await poolFixture(tokenEth, tokenDai, 3000, Factory, 0)).pool;

    //mint 1e30 token, you can call with arbitrary amount
    await mintSTDAmount(tokenEth);
    await mintSTDAmount(tokenUsdc);
    await mintSTDAmount(tokenDai);

    //deploy our contracts
    const registry = (await RegistryFixture(user.address)).registryFixture;
    const uniswapAddressHolder = await deployContract('UniswapAddressHolder', [
      NonFungiblePositionManager.address,
      Factory.address,
      SwapRouter.address,
      registry.address,
    ]);
    const diamondCutFacet = await deployContract('DiamondCutFacet');
    autoCompound = await deployContract('AutoCompoundModule', [uniswapAddressHolder.address, registry.address]);

    //deploy the PositionManagerFactory => deploy PositionManager
    const PositionManagerFactory = await deployPositionManagerFactoryAndActions(
      user.address,
      registry.address,
      diamondCutFacet.address,
      uniswapAddressHolder.address,
      '0x0000000000000000000000000000000000000000',
      ['CollectFees', 'IncreaseLiquidity', 'DecreaseLiquidity', 'UpdateUncollectedFees', 'SwapToPositionRatio']
    );

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
    await registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('AutoCompoundModule')),
      autoCompound.address,
      hre.ethers.utils.formatBytes32String('1'),
      true
    );
    await registry.addKeeperToWhitelist(user.address);

    PositionManager = (await getPositionManager(PositionManagerFactory, user)) as PositionManager;

    //select standard abicoder
    abiCoder = ethers.utils.defaultAbiCoder;

    //APPROVE
    await doAllApprovals(
      [user, liquidityProvider, trader],
      [NonFungiblePositionManager.address, PositionManager.address, SwapRouter.address],
      [tokenEth, tokenUsdc]
    );
    //approval user to registry for test

    await NonFungiblePositionManager.setApprovalForAll(PositionManager.address, true);

    // give pool some liquidity
    await NonFungiblePositionManager.connect(liquidityProvider).mint(
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
        recipient: liquidityProvider.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );

    const mintTx = await NonFungiblePositionManager.connect(user).mint(
      {
        token0: tokenEth.address,
        token1: tokenUsdc.address,
        fee: 3000,
        tickLower: 0 - 60 * 10,
        tickUpper: 0 + 60 * 10,
        amount0Desired: '0x' + (1e10).toString(16),
        amount1Desired: '0x' + (1e10).toString(16),
        amount0Min: 0,
        amount1Min: 0,
        recipient: PositionManager.address,
        deadline: Date.now() + 1000,
      },
      { gasLimit: 670000 }
    );

    const receipt: any = await mintTx.wait();
    tokenId = receipt.events[receipt.events.length - 1].args.tokenId;

    await PositionManager.pushPositionId(tokenId);

    // user approve autocompound module
    await PositionManager.toggleModule(2, autoCompound.address, true);
  });

  it('should not autocompound if fees are not enough', async function () {
    //do some trades to accrue fees
    for (let i = 0; i < 2; i++) {
      await SwapRouter.connect(trader).exactInputSingle([
        i % 2 === 0 ? tokenEth.address : tokenUsdc.address,
        i % 2 === 0 ? tokenUsdc.address : tokenEth.address,
        3000,
        trader.address,
        Date.now() + 1000,
        9e9,
        0,
        0,
      ]);
    }

    const position = await NonFungiblePositionManager.positions(2);
    await PositionManager.connect(user).setModuleData(2, autoCompound.address, abiCoder.encode(['uint256'], [30]));
    //collect and reinvest fees
    await expect(autoCompound.connect(user).autoCompoundFees(PositionManager.address, 2)).to.be.revertedWith('ACN');
    const positionPost = await NonFungiblePositionManager.positions(2);
    expect(positionPost.liquidity).to.be.equals(position.liquidity);
  });

  it('should be able to autocompound fees', async function () {
    //do some trades to accrue fees
    for (let i = 0; i < 20; i++) {
      await SwapRouter.connect(trader).exactInputSingle([
        i % 2 === 0 ? tokenEth.address : tokenUsdc.address,
        i % 2 === 0 ? tokenUsdc.address : tokenEth.address,
        3000,
        trader.address,
        Date.now() + 1000,
        9e9,
        0,
        0,
      ]);
    }

    const position = await NonFungiblePositionManager.positions(2);

    //collect and reinvest fees
    await PositionManager.connect(user).setModuleData(2, autoCompound.address, abiCoder.encode(['uint256'], [1]));
    await autoCompound.connect(user).autoCompoundFees(PositionManager.address, 2);
    const positionPost = await NonFungiblePositionManager.positions(2);
    expect(positionPost.liquidity).to.gt(position.liquidity);
  });

  it('should revert if position Manager does not exist', async function () {
    await PositionManager.connect(user).setModuleData(2, autoCompound.address, abiCoder.encode(['uint256'], [30]));
    await expect(autoCompound.connect(user).autoCompoundFees(Factory.address, 2)).to.be.reverted;
  });

  it('should revert if caller is not a whitelistedkeeper', async function () {
    await expect(autoCompound.connect(liquidityProvider).autoCompoundFees(PositionManager.address, 2)).to.be.reverted;
  });
});
