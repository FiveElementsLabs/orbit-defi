// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity 0.7.6;
pragma abicoder v2;

interface IClosePosition {
    function closePosition(uint256 tokenId, bool returnTokenToUser)
        external
        returns (
            uint256,
            uint256,
            uint256
        );
}
