// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

interface ISwap {
    function swap(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        bool returnTokensToUser
    ) external returns (uint256 amountOut);
}
