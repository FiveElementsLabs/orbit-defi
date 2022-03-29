// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../../helpers/SwapHelper.sol';

contract MockSwapHelper {
    function getRatioFromRange(
        int24 tickPool,
        int24 tickLower,
        int24 tickUpper
    ) public pure returns (uint256) {
        return SwapHelper.getRatioFromRange(tickPool, tickLower, tickUpper);
    }

    function calcAmountToSwap(
        int24 tickPool,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0In,
        uint256 amount1In
    ) public pure returns (uint256, bool) {
        return SwapHelper.calcAmountToSwap(tickPool, tickLower, tickUpper, amount0In, amount1In);
    }
}
