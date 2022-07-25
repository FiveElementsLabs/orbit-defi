// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

import '../../interfaces/IAToken.sol';
import '../../interfaces/ILendingPool.sol';
import '../../interfaces/IPositionManager.sol';
import '../../interfaces/actions/IAaveWithdraw.sol';
import '../utils/Storage.sol';

///@notice action to withdraw tokens from aave protocol
contract AaveWithdraw is IAaveWithdraw {
    ///@notice emitted when a withdraw from aave is made
    ///@param positionManager address of aave positionManager which withdrew
    ///@param token token address
    ///@param amount amount withdrawn
    ///@param returnTokensToUser true if withdrawn tokens are sent to positionManager owner
    ///@param closedPosition true if user has withdrawn the whole position
    event WithdrawnFromAave(
        address indexed positionManager,
        address token,
        uint256 amount,
        bool returnTokensToUser,
        bool closedPosition
    );

    ///@notice withdraw from aave some token amount
    ///@param token token address
    ///@param tokenId position to withdraw from
    ///@param partToWithdraw percentage of token to withdraw in base points
    ///@param returnTokensToUser true if withdrawn tokens are sent to positionManager owner
    ///@return amountWithdrawn amount of token withdrawn from aave
    function withdrawFromAave(
        address token,
        uint256 tokenId,
        uint256 partToWithdraw,
        bool returnTokensToUser
    ) external override returns (uint256 amountWithdrawn) {
        require(
            partToWithdraw != 0 && partToWithdraw <= 10_000,
            'AaveWithdraw::withdrawFromAave: part to withdraw must be between 0 and 10000'
        );
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        uint256 shares = uint256(
            PositionManagerStorage.getDynamicStorageValue(keccak256(abi.encodePacked(tokenId, 'aave_shares')))
        );
        uint256 totalShares = uint256(
            PositionManagerStorage.getDynamicStorageValue(keccak256(abi.encodePacked(token, 'aave_totalShares')))
        );

        require(shares != 0, 'AaveWithdraw::withdrawFromAave: no position to withdraw!');

        amountWithdrawn = ILendingPool(Storage.aaveAddressHolder.lendingPoolAddress()).withdraw(
            token,
            (_getAmount(token, tokenId, shares, totalShares) * partToWithdraw) / 10_000,
            returnTokensToUser ? Storage.owner : address(this)
        );

        _removeTokenIdFromAave(token, tokenId, partToWithdraw, shares, totalShares);
        emit WithdrawnFromAave(address(this), token, amountWithdrawn, returnTokensToUser, partToWithdraw == 10_000);
    }

    ///@notice gets balance of aToken associated to this position id
    ///@param token underlying token addrress
    ///@param tokenId id of the aave position
    ///@param shares shares of the position
    ///@param totalShares total shares of the underlying token
    ///@return amount of underlying token
    function _getAmount(
        address token,
        uint256 tokenId,
        uint256 shares,
        uint256 totalShares
    ) internal view returns (uint256) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        IAToken aToken = IAToken(
            ILendingPool(PositionManagerStorage.getStorage().aaveAddressHolder.lendingPoolAddress())
                .getReserveData(token)
                .aTokenAddress
        );

        return (aToken.balanceOf(address(this)) * shares) / totalShares;
    }

    ///@notice remove shares associated to withdrawn tokens and remove tokenID from aave reserves
    ///@param token address of token withdrawn
    ///@param tokenId of the withdrawn position
    ///@param partToWithdraw percentage of token to withdraw in base points
    ///@param shares shares of the position
    ///@param totalShares total shares of the underlying token
    function _removeTokenIdFromAave(
        address token,
        uint256 tokenId,
        uint256 partToWithdraw,
        uint256 shares,
        uint256 totalShares
    ) internal {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        uint256 sharesWithdrawn = (shares * partToWithdraw) / 10_000;

        PositionManagerStorage.setDynamicStorageValue(
            keccak256(abi.encodePacked(token, 'aave_totalShares')),
            bytes32(totalShares - sharesWithdrawn)
        );

        if (partToWithdraw == 10_000) {
            PositionManagerStorage.setDynamicStorageValue(
                keccak256(abi.encodePacked(tokenId, 'aave_shares')),
                bytes32(0)
            );
        } else {
            PositionManagerStorage.setDynamicStorageValue(
                keccak256(abi.encodePacked(tokenId, 'aave_shares')),
                bytes32(shares - sharesWithdrawn)
            );
        }
    }
}
