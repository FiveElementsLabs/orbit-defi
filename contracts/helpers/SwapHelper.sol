// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@uniswap/v3-core/contracts/libraries/FixedPoint96.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import './SafeInt24Math.sol';
import './SafeInt56Math.sol';
import './MathHelper.sol';
import 'hardhat/console.sol';

///@title library to help with swap amounts calculations
library SwapHelper {
    using SafeInt24Math for int24;
    using SafeInt56Math for int56;
    using SafeMath for uint256;

    ///@notice returns the amount of token1 needed for a mint for 1e18 token0
    ///@param tickPool tick of the pool
    ///@param tickLower lower tick of position
    ///@param tickUpper upper tick of position
    ///@return ratioE18 amount1/amount0 * 1e18
    function getRatioFromRange(
        int24 tickPool,
        int24 tickLower,
        int24 tickUpper
    ) internal view returns (uint256) {
        require(
            tickLower < tickPool && tickUpper > tickPool,
            'SwapHelper::getRatioFromRange: Position should be in range to call this function'
        );
        console.log(
            'getRatio::tickPool: ',
            (tickPool >= 0 ? '' : '-'),
            tickPool >= 0 ? uint256(tickPool) : uint256(-tickPool)
        );
        console.log(
            'getRatio::tickLower: ',
            (tickLower >= 0 ? '' : '-'),
            tickLower >= 0 ? uint256(tickLower) : uint256(-tickLower)
        );
        console.log(
            'getRatio::tickUpper: ',
            (tickUpper >= 0 ? '' : '-'),
            tickUpper >= 0 ? uint256(tickUpper) : uint256(-tickUpper)
        );
        uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tickPool);
        uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(tickLower);
        uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(tickUpper);
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmount0(sqrtRatioX96, sqrtRatioBX96, FixedPoint96.Q96);
        console.log('liquidity: ', liquidity);
        (uint256 newAmount0, uint256 ratioX96) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtRatioX96,
            sqrtRatioAX96,
            sqrtRatioBX96,
            liquidity
        );
        console.log('newAmount0: ', newAmount0);
        console.log('ratioX96: ', ratioX96);
        return ratioX96;
    }

    ///@notice calculate amount to be swapped in order to deposit according to the ratio selected position needs
    ///@param tickPool tick of the pool
    ///@param tickLower lower tick of position
    ///@param tickUpper upper tick of position
    ///@param amount0In amount of token0 available
    ///@param amount1In amount of token1 available
    ///@return amountToSwap amount of token to be swapped
    ///@return token0In true if token0 is swapped for token1, false if token1 is swapped for token1
    function calcAmountToSwap(
        int24 tickPool,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0In,
        uint256 amount1In
    ) internal view returns (uint256 amountToSwap, bool token0In) {
        require(amount0In != 0 || amount1In != 0, 'SwapHelper::calcAmountToSwap: at least one amountIn should be != 0');

        //if tickPoolool >= tickUpper, then my range is under the current tick, so my position will all be in token1
        if (tickPool >= tickUpper) {
            amountToSwap = amount0In;
            token0In = true;
        }
        //if tickPoolool <= tickUpper, then my range is over the current tick, so my position will all be in token1
        else if (tickPool <= tickLower) {
            amountToSwap = amount1In;
            token0In = false;
        } else {
            uint256 ratioX96 = getRatioFromRange(tickPool, tickLower, tickUpper);
            console.log('SwapHelper::calcAmountToSwap: ratioX96', ratioX96);

            uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tickPool);
            console.log('SwapHelper::calcAmountToSwap: sqrtPriceX96', sqrtPriceX96);

            uint256 valueX96 = (amount0In.mul((uint256(sqrtPriceX96)**2) >> FixedPoint96.RESOLUTION)).add(
                amount1In << FixedPoint96.RESOLUTION
            );
            console.log('SwapHelper::calcAmountToSwap: valueX96', valueX96);

            // uint256 amount1PostX96 = (ratioE18.mul(valueX96)).div(ratioE18.add(1e18));
            // console.log('SwapHelper::calcAmountToSwap: amount1PostX96', amount1PostX96);

            uint256 amount0Post = valueX96.div(((uint256(sqrtPriceX96)**2) >> FixedPoint96.RESOLUTION).add(ratioX96));
            console.log('SwapHelper::calcAmountToSwap: amount0PostX96', amount0Post);

            token0In = amount0Post < amount0In;
            console.log('SwapHelper::calcAmountToSwap: token0In', token0In);

            if (token0In) {
                // amountToSwap = ((amount1PostX96.sub(amount1In << FixedPoint96.RESOLUTION)).div(sqrtPriceX96) <<
                //     FixedPoint96.RESOLUTION).div(sqrtPriceX96);
                amountToSwap = amount0In.sub(amount0Post);
                console.log('SwapHelper::calcAmountToSwap: amountToSwap', amountToSwap);
            } else {
                // amountToSwap = amount1In.sub(amount1PostX96 >> FixedPoint96.RESOLUTION);
                amountToSwap = (amount0Post).mul(ratioX96) >> FixedPoint96.RESOLUTION;
                console.log('SwapHelper::calcAmountToSwap: amountToSwap', amountToSwap);
            }
        }
    }

    ///@notice Check price volatility is under specified threshold. This mitigates price manipulation during rebalance
    ///@param pool v3 pool
    ///@param maxTwapDeviation max deviation threshold from the twap tick price
    ///@param twapDuration duration of the twap oracle observations
    function checkDeviation(
        IUniswapV3Pool pool,
        int24 maxTwapDeviation,
        uint32 twapDuration
    ) internal view {
        (, int24 currentTick, , , , , ) = pool.slot0();
        int24 twap = getTwap(pool, twapDuration);
        int24 deviation = currentTick > twap ? currentTick.sub(twap) : twap.sub(currentTick);
        require(deviation <= maxTwapDeviation, 'SwapHelper::checkDeviation: Price deviation is too high');
    }

    ///@notice Fetch time-weighted average price in ticks from Uniswap pool for specified duration
    ///@param pool v3 pool
    ///@param twapDuration duration of the twap oracle observations
    function getTwap(IUniswapV3Pool pool, uint32 twapDuration) internal view returns (int24) {
        uint32[] memory secondsAgo = new uint32[](2);
        secondsAgo[0] = twapDuration;
        secondsAgo[1] = 0; // 0 is the most recent observation

        (int56[] memory tickCumulatives, ) = pool.observe(secondsAgo);

        return MathHelper.fromInt56ToInt24(tickCumulatives[1].sub(tickCumulatives[0]).div(int56(twapDuration)));
    }
}
