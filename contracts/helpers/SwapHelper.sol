// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol';
import '@uniswap/v3-core/contracts/libraries/FixedPoint96.sol';

library SwapHelper {
    function getRatioFromRange(
        int24 tickPool,
        int24 tickLower,
        int24 tickUpper
    ) public pure returns (uint256 ratioE18) {
        require(tickLower < tickPool && tickUpper > tickPool, 'Position should be in range to call this function');
        uint256 amount0 = 1e18;
        uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tickPool);
        uint160 sqrtPriceLowerX96 = TickMath.getSqrtRatioAtTick(tickLower);
        uint160 sqrtPriceUpperX96 = TickMath.getSqrtRatioAtTick(tickUpper);

        // @dev Calculates amount0 * (sqrt(upper) * sqrt(lower)) / (sqrt(upper) - sqrt(lower))
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmount0(sqrtPriceX96, sqrtPriceUpperX96, amount0);
        ratioE18 = LiquidityAmounts.getAmount1ForLiquidity(sqrtPriceX96, sqrtPriceLowerX96, liquidity);
    }

    function calcAmountToSwap(
        int24 tickPool,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0In,
        uint256 amount1In
    ) public pure returns (uint256 amountToSwap, bool token0In) {
        require(amount0In > 0 || amount1In > 0);
        if (tickPool <= tickLower) {
            amountToSwap = amount0In;
            token0In = true;
        } else if (tickPool >= tickUpper) {
            amountToSwap = amount1In;
            token0In = false;
        } else {
            uint256 ratioE18 = getRatioFromRange(tickPool, tickLower, tickUpper);

            uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tickPool);

            uint256 valueX96 = (amount0In * ((uint256(sqrtPriceX96)**2) >> FixedPoint96.RESOLUTION)) +
                (amount1In << FixedPoint96.RESOLUTION);

            uint256 amount1PostX96 = (ratioE18 * valueX96) / (ratioE18 + 1e18);

            token0In = !(amount1In >= (amount1PostX96 >> FixedPoint96.RESOLUTION));
            if (token0In) {
                amountToSwap =
                    (((amount1PostX96 - (amount1In << FixedPoint96.RESOLUTION)) / sqrtPriceX96) <<
                        FixedPoint96.RESOLUTION) /
                    sqrtPriceX96;
            } else {
                amountToSwap = amount1In - (amount1PostX96 >> FixedPoint96.RESOLUTION);
            }
        }
    }
}
