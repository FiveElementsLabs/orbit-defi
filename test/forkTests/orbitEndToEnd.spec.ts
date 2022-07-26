import { expect } from 'chai';
import { AbiCoder } from 'ethers/lib/utils';
import hre, { ethers } from 'hardhat';
import { MockToken, PositionManager } from '../../typechain';
import {
  deployContract,
  deployOrbit,
  doAllApprovals,
  getMainnetContracts,
  getPositionManager,
  mintForkedTokens,
} from '../shared/fixtures';
import PositionManagerjson from '../../artifacts/contracts/PositionManager.sol/PositionManager.json';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';

describe('Global Tests', function () {
  let governance: any = ethers.getSigners().then(async (signers) => {
    return signers[0];
  });
  let user1: any = ethers.getSigners().then(async (signers) => {
    return signers[1];
  });
  let keeper: any = ethers.getSigners().then(async (signers) => {
    return signers[2];
  });
  let user2: any = ethers.getSigners().then(async (signers) => {
    return signers[3];
  });
  let user3: any = ethers.getSigners().then(async (signers) => {
    return signers[4];
  });
  let trader: any = ethers.getSigners().then(async (signers) => {
    return signers[5];
  });
  let contracts: any;
  let orbit: any;
  let positionManager1: PositionManager, positionManager2: PositionManager, positionManager3: PositionManager;
  let usdcMock: MockToken, wbtcMock: MockToken, daiMock: MockToken;
  let abiCoder: AbiCoder;
  let mockNFTHelper: any;
  const bytes200 = '0x00000000000000000000000000000000000000000000000000000000000000c8';
  const bytes1 = '0x0000000000000000000000000000000000000000000000000000000000000001';

  before(async function () {
    governance = await governance;
    user1 = await user1;
    user2 = await user2;
    user3 = await user3;
    keeper = await keeper;
    trader = await trader;
    //deploy contracts
    contracts = await getMainnetContracts();
    orbit = await deployOrbit(governance, keeper, contracts);
    positionManager1 = (await getPositionManager(orbit.PositionManagerFactory, user1)) as PositionManager;
    positionManager2 = (await getPositionManager(orbit.PositionManagerFactory, user2)) as PositionManager;
    positionManager3 = (await getPositionManager(orbit.PositionManagerFactory, user3)) as PositionManager;
    mockNFTHelper = await deployContract('MockUniswapNFTHelper', []);

    //Get mock tokens. These need to be real ethereum Mainnet addresses
    usdcMock = (await ethers.getContractAt('MockToken', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')) as MockToken;
    wbtcMock = (await ethers.getContractAt('MockToken', '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599')) as MockToken;
    daiMock = (await ethers.getContractAt('MockToken', '0x6B175474E89094C44Da98b954EedeAC495271d0F')) as MockToken;
    await mintForkedTokens([usdcMock, wbtcMock, daiMock], [user1, user2, user3, governance, keeper, trader], 1e13);

    //approve NFPM
    await doAllApprovals(
      [user1, user2, user3, governance, keeper, trader],
      [
        contracts.NonFungiblePositionManager.address,
        contracts.SwapRouter.address,
        orbit.DepositRecipes.address,
        positionManager1.address,
      ],
      [usdcMock, wbtcMock, daiMock]
    );
    await contracts.NonFungiblePositionManager.connect(user1).setApprovalForAll(orbit.DepositRecipes.address, true);
    await contracts.NonFungiblePositionManager.connect(user2).setApprovalForAll(orbit.DepositRecipes.address, true);
    await contracts.NonFungiblePositionManager.connect(user3).setApprovalForAll(orbit.DepositRecipes.address, true);

    abiCoder = ethers.utils.defaultAbiCoder;
  });

  it('should allow user1 to zap a position with custom range and set module parameters', async function () {
    const feeTier = 3000;
    const tick = (await contracts.PoolWbtcUsdc3000.slot0()).tick;
    const tickSpacing = feeTier / 50;
    const tickLower = Math.round(tick / tickSpacing) * tickSpacing - 150 * tickSpacing;
    const tickUpper = Math.round(tick / tickSpacing) * tickSpacing + 127 * tickSpacing;
    const amount0 = 1e7;
    const mintTx = await orbit.DepositRecipes.connect(user1).zapInUniNft(
      wbtcMock.address,
      usdcMock.address,
      false,
      amount0,
      tickLower,
      tickUpper,
      feeTier
    );

    let receipt = await mintTx.wait();
    const data = receipt.events[receipt.events.length - 1].data;
    const tokenId = abiCoder.decode(['uint256', 'address', 'uint256'], data)[0];
    let positions = await positionManager1.getAllUniPositions();
    expect(positions).to.deep.equal([tokenId]);
    const position = await contracts.NonFungiblePositionManager.positions(tokenId);
    expect(position.token0).to.equal(wbtcMock.address);
    expect(position.token1).to.equal(usdcMock.address);
    expect(position.tickLower).to.equal(tickLower);
    expect(position.tickUpper).to.equal(tickUpper);
    expect(position.fee).to.equal(feeTier);
    expect(await contracts.NonFungiblePositionManager.ownerOf(tokenId)).to.equal(positionManager1.address);

    let info = await positionManager1.getModuleInfo(tokenId, orbit.AaveModule.address);
    expect(info.isActive).to.equal(true);
    expect(info.data).to.equal(bytes200);
    info = await positionManager1.getModuleInfo(tokenId, orbit.AutoCompoundModule.address);
    expect(info.isActive).to.equal(true);
    expect(info.data).to.equal(bytes1);
    info = await positionManager1.getModuleInfo(tokenId, orbit.IdleLiquidityModule.address);
    expect(info.isActive).to.equal(false);
    expect(info.data).to.equal(bytes200);

    const newAaveData = '0x0000000000000000000000000000000000000000000000000000000000000038';
    await positionManager1.connect(user1).setModuleData(tokenId, orbit.AaveModule.address, newAaveData);
    await positionManager1.connect(user1).toggleModule(tokenId, orbit.AutoCompoundModule.address, false);

    info = await positionManager1.getModuleInfo(tokenId, orbit.AaveModule.address);
    expect(info.isActive).to.equal(true);
    expect(info.data).to.equal(newAaveData);
    info = await positionManager1.getModuleInfo(tokenId, orbit.AutoCompoundModule.address);
    expect(info.isActive).to.equal(false);
    expect(info.data).to.equal(bytes1);
    info = await positionManager1.getModuleInfo(tokenId, orbit.IdleLiquidityModule.address);
    expect(info.isActive).to.equal(false);
    expect(info.data).to.equal(bytes200);
  });

  it('should allow user2 to deposit an already minted position and set custom parameters', async function () {
    const feeTier = 100;
    const tick = (await contracts.PoolDaiUsdc100.slot0()).tick;
    const tickSpacing = feeTier / 50;
    const tickLower = Math.round(tick / tickSpacing) * tickSpacing - 1 * tickSpacing;
    const tickUpper = Math.round(tick / tickSpacing) * tickSpacing + 1 * tickSpacing;
    const mintTx = await contracts.NonFungiblePositionManager.connect(user2).mint({
      token0: daiMock.address,
      token1: usdcMock.address,
      fee: feeTier,
      tickLower: tickLower,
      tickUpper: tickUpper,
      amount0Desired: '0x' + (1e18).toString(16),
      amount1Desired: '0x' + (1e6).toString(16),
      amount0Min: 0,
      amount1Min: 0,
      recipient: user2.address,
      deadline: Date.now() + 1000,
    });

    let receipt = await mintTx.wait();
    const tokenId = receipt.events[receipt.events.length - 1].args.tokenId;

    await orbit.DepositRecipes.connect(user2).depositUniNft([tokenId]);
    let positions = await positionManager2.getAllUniPositions();
    expect(await contracts.NonFungiblePositionManager.ownerOf(tokenId)).to.equal(positionManager2.address);
    expect(positions).to.deep.equal([tokenId]);

    let info = await positionManager2.getModuleInfo(tokenId, orbit.AaveModule.address);
    expect(info.isActive).to.equal(true);
    expect(info.data).to.equal(bytes200);
    info = await positionManager2.getModuleInfo(tokenId, orbit.AutoCompoundModule.address);
    expect(info.isActive).to.equal(true);
    expect(info.data).to.equal(bytes1);
    info = await positionManager2.getModuleInfo(tokenId, orbit.IdleLiquidityModule.address);
    expect(info.isActive).to.equal(false);
    expect(info.data).to.equal(bytes200);

    const newAaveData = '0x0000000000000000000000000000000000000000000000000000000000000003';
    await positionManager2.connect(user2).setModuleData(tokenId, orbit.AaveModule.address, newAaveData);

    info = await positionManager2.getModuleInfo(tokenId, orbit.AaveModule.address);
    expect(info.isActive).to.equal(true);
    expect(info.data).to.equal(newAaveData);
    info = await positionManager2.getModuleInfo(tokenId, orbit.AutoCompoundModule.address);
    expect(info.isActive).to.equal(true);
    expect(info.data).to.equal(bytes1);
    info = await positionManager2.getModuleInfo(tokenId, orbit.IdleLiquidityModule.address);
    expect(info.isActive).to.equal(false);
    expect(info.data).to.equal(bytes200);
  });

  it('should allow user3 to mint and deposit a new position and set custom parameters', async function () {
    const feeTier = 3000;
    const tick = (await contracts.PoolWbtcDai3000.slot0()).tick;
    const tickSpacing = feeTier / 50;
    const tickLower = Math.round(tick / tickSpacing) * tickSpacing - 1000 * tickSpacing;
    const tickUpper = Math.round(tick / tickSpacing) * tickSpacing - 500 * tickSpacing;
    const mintTx = await orbit.DepositRecipes.connect(user3).mintAndDeposit(
      wbtcMock.address,
      daiMock.address,
      feeTier,
      tickLower,
      tickUpper,
      '0x' + (1e18).toString(16),
      '0x' + (1e18).toString(16)
    );

    let receipt = await mintTx.wait();
    const data = receipt.events[receipt.events.length - 1].data;
    const tokenId = abiCoder.decode(['uint256'], data)[0];

    let positions = await positionManager3.getAllUniPositions();
    expect(await contracts.NonFungiblePositionManager.ownerOf(tokenId)).to.equal(positionManager3.address);
    expect(positions).to.deep.equal([tokenId]);

    let info = await positionManager3.getModuleInfo(tokenId, orbit.AaveModule.address);
    expect(info.isActive).to.equal(true);
    expect(info.data).to.equal(bytes200);
    info = await positionManager3.getModuleInfo(tokenId, orbit.AutoCompoundModule.address);
    expect(info.isActive).to.equal(true);
    expect(info.data).to.equal(bytes1);
    info = await positionManager3.getModuleInfo(tokenId, orbit.IdleLiquidityModule.address);
    expect(info.isActive).to.equal(false);
    expect(info.data).to.equal(bytes200);

    const newAutoCompoundData = '0x0000000000000000000000000000000000000000000000000000000000000003';
    await positionManager3.connect(user3).setModuleData(tokenId, orbit.AutoCompoundModule.address, newAutoCompoundData);
    await positionManager3.connect(user3).toggleModule(tokenId, orbit.AutoCompoundModule.address, false);
    await positionManager3.connect(user3).toggleModule(tokenId, orbit.AaveModule.address, false);
    await positionManager3.connect(user3).toggleModule(tokenId, orbit.IdleLiquidityModule.address, true);

    info = await positionManager3.getModuleInfo(tokenId, orbit.AaveModule.address);
    expect(info.isActive).to.equal(false);
    expect(info.data).to.equal(bytes200);
    info = await positionManager3.getModuleInfo(tokenId, orbit.AutoCompoundModule.address);
    expect(info.isActive).to.equal(false);
    expect(info.data).to.equal(newAutoCompoundData);
    info = await positionManager3.getModuleInfo(tokenId, orbit.IdleLiquidityModule.address);
    expect(info.isActive).to.equal(true);
    expect(info.data).to.equal(bytes200);
  });

  it('should execute a rebalance when a position is out of range', async function () {
    const expectedCompounds: any = [];
    const expectedRebalances = await positionManager3.getAllUniPositions();
    const expectedAave: any = [];
    const positions = await runKeeper(orbit, keeper);
    expect(positions.compounded).to.eql(expectedCompounds);
    expect(positions.rebalanced).to.eql(expectedRebalances);
    expect(positions.movedToAave).to.eql(expectedAave);
  });

  it('should execute a compound when fee threshold is met', async function () {
    const DaiUsdcPositionId = (await positionManager2.getAllUniPositions())[0];
    const amounts = await mockNFTHelper.getAmountsfromTokenId(
      DaiUsdcPositionId,
      contracts.NonFungiblePositionManager.address,
      contracts.UniswapV3Factory.address
    );

    // workaround to make a call to update fees even if nft is hold by a contract
    const updateFees = await ethers.getContractAt('UpdateUncollectedFees', positionManager2.address);
    await orbit.Registry.addNewContract(
      hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes('Keeper')),
      keeper.address,
      ethers.utils.hexZeroPad(ethers.utils.hexlify(1), 32),
      true
    );
    let tokensOwed = await updateFees.connect(keeper).callStatic.updateUncollectedFees(DaiUsdcPositionId);
    let i = 0;
    while (tokensOwed[0].mul(100).lt(amounts[0]) || tokensOwed[1].mul(100).lt(amounts[1])) {
      await contracts.SwapRouter.connect(trader).exactInputSingle({
        tokenIn: i % 2 == 0 ? daiMock.address : usdcMock.address,
        tokenOut: i % 2 == 0 ? usdcMock.address : daiMock.address,
        fee: 100,
        recipient: trader.address,
        deadline: Date.now() + 100,
        amountIn: i % 2 == 0 ? '0x' + (3e26).toString(16) : '0x' + (3e14).toString(16),
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      });
      tokensOwed = await updateFees.connect(keeper).callStatic.updateUncollectedFees(DaiUsdcPositionId);
      i++;
    }

    const expectedCompounds: any = [DaiUsdcPositionId];
    const expectedRebalances: any = [];
    const expectedAave: any = [];
    const positions = await runKeeper(orbit, keeper);
    expect(positions.compounded).to.eql(expectedCompounds);
    expect(positions.rebalanced).to.eql(expectedRebalances);
    expect(positions.movedToAave).to.eql(expectedAave);
  });

  it('should move liquidity to aave when a position is out of range', async function () {
    let PoolWbtcUsdc3000Tick = (await contracts.PoolWbtcUsdc3000.slot0()).tick;
    const WbtcUsdcPositionId = (await positionManager1.getAllUniPositions())[0];
    const WbtcUsdcPosition = await contracts.NonFungiblePositionManager.positions(WbtcUsdcPositionId);
    while (
      WbtcUsdcPosition.tickLower * (1 - Math.sign(WbtcUsdcPosition.tickLower) * 0.02) <= PoolWbtcUsdc3000Tick &&
      PoolWbtcUsdc3000Tick <= WbtcUsdcPosition.tickUpper * (1 + Math.sign(WbtcUsdcPosition.tickUpper) * 0.02)
    ) {
      await contracts.SwapRouter.connect(trader).exactInputSingle({
        tokenIn: wbtcMock.address,
        tokenOut: usdcMock.address,
        fee: 3000,
        recipient: trader.address,
        deadline: Date.now() + 100,
        amountIn: '0x' + (1e10).toString(16),
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      });
      PoolWbtcUsdc3000Tick = (await contracts.PoolWbtcUsdc3000.slot0()).tick;
    }

    const expectedCompounds: any = [];
    const expectedRebalances: any = [];
    const expectedAave: any = [WbtcUsdcPositionId];
    await orbit.Registry.connect(governance).setMaxTwapDeviation(1000000);
    const positions = await runKeeper(orbit, keeper);
    await orbit.Registry.connect(governance).setMaxTwapDeviation(100);
    expect(positions.compounded).to.eql(expectedCompounds);
    expect(positions.rebalanced).to.eql(expectedRebalances);
    expect(positions.movedToAave).to.eql(expectedAave);
  });

  it('should allow all user1 to withdraw his position from aave', async function () {
    const user1WbtcBalance = await wbtcMock.balanceOf(user1.address);
    const positions = await positionManager1.getAllUniPositions();
    await orbit.WithdrawRecipes.connect(user1).withdrawFromAave(positions[0], 10000);
    expect(await positionManager1.getAllUniPositions()).to.be.empty;
    expect(await wbtcMock.balanceOf(user1.address)).to.gt(user1WbtcBalance);
  });

  it('should allow all user2 to withdraw his position, 50% at a time', async function () {
    const user2UsdcBalance = await usdcMock.balanceOf(user2.address);
    const user2DaiBalance = await daiMock.balanceOf(user2.address);
    const user2Positions = await positionManager2.getAllUniPositions();
    const positionBefore = await contracts.NonFungiblePositionManager.positions(user2Positions[0]);

    await orbit.WithdrawRecipes.connect(user2).withdrawUniNft(user2Positions[0], 5000);
    const user2UsdcMiddleBalance = await usdcMock.balanceOf(user2.address);
    const user2DaiMiddleBalance = await daiMock.balanceOf(user2.address);
    expect((await contracts.NonFungiblePositionManager.positions(user2Positions[0])).liquidity).to.be.closeTo(
      positionBefore.liquidity.div(BigNumber.from(2)),
      positionBefore.liquidity.div(BigNumber.from(1000))
    );
    expect(user2UsdcMiddleBalance).to.gt(user2UsdcBalance);
    expect(user2DaiMiddleBalance).to.gt(user2DaiBalance);
    expect(await positionManager2.getAllUniPositions()).to.eql(user2Positions);

    await orbit.WithdrawRecipes.connect(user2).withdrawUniNft(user2Positions[0], 10000);
    expect(await positionManager2.getAllUniPositions()).to.be.empty;
    expect(await usdcMock.balanceOf(user2.address)).to.be.gt(user2UsdcMiddleBalance);
    expect(await daiMock.balanceOf(user2.address)).to.be.gt(user2DaiMiddleBalance);
  });

  it('should allow all user3 to zap out his position', async function () {
    const user3WbtcBalance = await wbtcMock.balanceOf(user3.address);
    const user3DaiBalance = await daiMock.balanceOf(user3.address);
    const user3Positions = await positionManager3.getAllUniPositions();
    await orbit.WithdrawRecipes.connect(user3).zapOutUniNft(user3Positions[0], daiMock.address);
    expect(await positionManager3.getAllUniPositions()).to.be.empty;
    expect(await wbtcMock.balanceOf(user3.address)).to.be.equal(user3WbtcBalance);
    expect(await daiMock.balanceOf(user3.address)).to.be.gt(user3DaiBalance);
  });
});

async function runKeeper(orbit: any, keeper: SignerWithAddress) {
  let positionManagers = await orbit.PositionManagerFactory.getAllPositionManagers();
  let data: any, positions: any, positionManager: any;
  let compounded: any = [],
    rebalanced: any = [],
    movedToAave: any = [];
  for (let i = 0; i < positionManagers.length; i++) {
    positionManager = await ethers.getContractAt(PositionManagerjson['abi'], positionManagers[i]);
    positions = await positionManager.getAllUniPositions();
    for (let j = 0; j < positions.length; j++) {
      data = await positionManager.getModuleInfo(positions[j], orbit.AutoCompoundModule.address);
      if (data.isActive) {
        try {
          await orbit.AutoCompoundModule.connect(keeper).autoCompoundFees(positionManager.address, positions[j]);
          compounded.push(positions[j]);
        } catch {}
      }
      data = await positionManager.getModuleInfo(positions[j], orbit.IdleLiquidityModule.address);
      if (data.isActive) {
        try {
          await orbit.IdleLiquidityModule.connect(keeper).rebalance(positionManager.address, positions[j]);
          rebalanced.push(positions[j]);
        } catch {}
      }
      data = await positionManager.getModuleInfo(positions[j], orbit.AaveModule.address);
      if (data.isActive) {
        try {
          await orbit.AaveModule.connect(keeper).moveToAave(positionManager.address, positions[j]);
          movedToAave.push(positions[j]);
        } catch {}
      }
    }
  }

  return {
    compounded: compounded,
    rebalanced: rebalanced,
    movedToAave: movedToAave,
  };
}
