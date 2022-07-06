// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

interface ISwapToPositionRatio {
    struct SwapToPositionInput {
        address token0;
        address token1;
        uint24 fee;
        uint256 amount0;
        uint256 amount1;
        int24 tickLower;
        int24 tickUpper;
    }

    function swapToPositionRatioV2(SwapToPositionInput memory inputs)
        external
        returns (uint256 amount0Out, uint256 amount1Out);
}
