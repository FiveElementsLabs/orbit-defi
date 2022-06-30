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
    ///@param id position to withdraw from
    ///@param partToWithdraw percentage of token to withdraw in base points
    ///@param returnTokensToUser true if withdrawn tokens are sent to positionManager owner
    ///@return amountWithdrawn amount of token withdrawn from aave
    function withdrawFromAave(
        address token,
        uint256 id,
        uint256 partToWithdraw,
        bool returnTokensToUser
    ) public override returns (uint256 amountWithdrawn) {
        require(
            partToWithdraw != 0 && partToWithdraw <= 10_000,
            'AaveWithdraw::withdrawFromAave: part to withdraw must be between 0 and 10000'
        );
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        require(
            Storage.aaveUserReserves[token].positionShares[id] > 0,
            'PositionManager::removeAavePosition: no position to withdraw!'
        );

        uint256 amount = (_getAmount(token, id) * partToWithdraw) / 10_000;

        amountWithdrawn = ILendingPool(Storage.aaveAddressHolder.lendingPoolAddress()).withdraw(
            token,
            amount,
            returnTokensToUser ? Storage.owner : address(this)
        );

        _removeShares(token, id, partToWithdraw);
        emit WithdrawnFromAave(address(this), token, amountWithdrawn, returnTokensToUser, partToWithdraw == 10_000);
    }

    ///@notice gets balance of aToken associated to this position id
    ///@param token underlying token addrress
    ///@param id id of the aave position
    ///@return amount of underlying token
    function _getAmount(address token, uint256 id) internal view returns (uint256 amount) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        IAToken aToken = IAToken(
            ILendingPool(PositionManagerStorage.getStorage().aaveAddressHolder.lendingPoolAddress())
                .getReserveData(token)
                .aTokenAddress
        );

        amount =
            (aToken.balanceOf(address(this)) * Storage.aaveUserReserves[token].positionShares[id]) /
            Storage.aaveUserReserves[token].sharesEmitted;
    }

    ///@notice remove shares associated to withdrawn tokens
    ///@param token address of token withdrawn
    ///@param id of the withdrawn position
    ///@param partToWithdraw percentage of token to withdraw in base points
    function _removeShares(
        address token,
        uint256 id,
        uint256 partToWithdraw
    ) internal {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        Storage.aaveUserReserves[token].sharesEmitted -=
            (Storage.aaveUserReserves[token].positionShares[id] * partToWithdraw) /
            10_000;
        if (partToWithdraw == 10_000) {
            Storage.aaveUserReserves[token].positionShares[id] = 0;
            Storage.aaveUserReserves[token].tokenIds[id] = 0;
        } else {
            Storage.aaveUserReserves[token].positionShares[id] -= partToWithdraw;
        }
    }
}
