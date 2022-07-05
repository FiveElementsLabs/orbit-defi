// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

interface ISwap {
    function swapV2(
        address token0Address,
        address token1Address,
        uint24 fee,
        uint256 amount0In
    ) external returns (uint256 amount1Out);
}
