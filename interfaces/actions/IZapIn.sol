// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

interface IZapIn {
    function zapIn(
        address token0,
        address token1,
        bool isToken0In,
        uint256 amountIn,
        int24 tickLower,
        int24 tickUpper,
        uint24 fee
    ) external returns (uint256);
}
