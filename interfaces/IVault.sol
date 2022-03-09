// SPDX-License-Identifier: Unlicense

pragma solidity 0.7.6;

interface IVault {
    function depositUniNft(
        address from,
        uint256 tokenId
        ) external;
}
