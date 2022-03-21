// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../interfaces/IVault.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol';
import '@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol';
import '@uniswap/v3-core/contracts/libraries/FixedPoint96.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import 'hardhat/console.sol';

contract IdleLiquidityModule {
    INonfungiblePositionManager public immutable nonFungiblePositionManager;
    address public immutable uniswapV3FactoryAddress;

    constructor(INonfungiblePositionManager _nonfungiblePositionManager, address _uniswapV3Factory) {
        nonFungiblePositionManager = _nonfungiblePositionManager;
        uniswapV3FactoryAddress = _uniswapV3Factory;
    }

    //returns distance from position (in ticks), if output is negative => position is out of range
    function checkDistanceFromRange(uint256 tokenId) public view returns (int24) {
        (
            ,
            ,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            ,
            ,
            ,
            ,

        ) = nonFungiblePositionManager.positions(tokenId);
        address poolAddress = PoolAddress.computeAddress(
            uniswapV3FactoryAddress,
            PoolAddress.getPoolKey(token0, token1, fee)
        );
        IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
        (, int24 tick, , , , , ) = pool.slot0();

        int24 distanceFromUpper = tickUpper - tick;
        int24 distanceFromLower = tick - tickLower;
        return min24(distanceFromLower, distanceFromUpper);
    }

    function getRatioFromRange(
        int24 tickPool,
        int24 tickLower,
        int24 tickUpper
    ) public pure returns (uint256 ratioE18) {
        uint256 amount0 = 1e18;
        uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tickPool);
        uint160 sqrtPriceLowerX96 = TickMath.getSqrtRatioAtTick(tickLower);
        uint160 sqrtPriceUpperX96 = TickMath.getSqrtRatioAtTick(tickUpper);

        // @dev Calculates amount0 * (sqrt(upper) * sqrt(lower)) / (sqrt(upper) - sqrt(lower))
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmount0(sqrtPriceX96, sqrtPriceUpperX96, amount0);
        ratioE18 = LiquidityAmounts.getAmount1ForLiquidity(sqrtPriceX96, sqrtPriceLowerX96, liquidity);
    }

    function amount1toSwap(
        int24 tickPool,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Input,
        uint256 amount1Input
    ) public pure returns (int256 yToSwap) {
        uint256 ratioE18 = getRatioFromRange(tickPool, tickLower, tickUpper);

        uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tickPool);

        uint256 valueX96 = (amount0Input * ((uint256(sqrtPriceX96)**2) >> 96)) + (amount1Input << 96);

        uint256 y = ((ratioE18 * valueX96) / (ratioE18 + 1e18)) >> 96;

        yToSwap = int256(amount1Input - y);
    }

    function min24(int24 a, int24 b) internal pure returns (int24) {
        return a <= b ? a : b;
    }
}
