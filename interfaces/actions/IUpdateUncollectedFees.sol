// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity 0.7.6;
pragma abicoder v2;

interface IUpdateUncollectedFees {
    function updateUncollectedFees(uint256 tokenId) external returns (uint256, uint256);
}
