// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

interface IAaveDeposit {
    ///@notice deposit to aave some token amount
    ///@param token token address
    ///@param amount amount to deposit
    ///@param tokenId tokenId of the position deposited to aave
    ///@return shares emitted
    function depositToAave(
        address token,
        uint256 amount,
        uint256 tokenId
    ) external returns (uint256 shares);
}
