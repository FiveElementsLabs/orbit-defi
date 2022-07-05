// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

interface IZapOut {
    function zapOutV2(uint256 tokenId, address tokenOut) external returns (uint256);
}
