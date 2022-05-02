// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../../interfaces/IAToken.sol';
import '../../interfaces/ILendingPool.sol';
import '../../interfaces/IPositionManager.sol';
import '../utils/Storage.sol';

interface IAaveWithdraw {
    ///@notice withdraw from aave some token amount
    ///@param token token address
    ///@param id position to withdraw from
    ///@return amountWithdrawn amount of token withdrawn from aave
    function withdrawFromAave(address token, uint256 id) external returns (uint256 amountWithdrawn);
}

///@notice action to withdraw tokens from aave protocol
contract AaveWithdraw is IAaveWithdraw {
    ///@notice withdraw from aave some token amount
    ///@param token token address
    ///@param id position to withdraw from
    ///@return amountWithdrawn amount of token withdrawn from aave
    function withdrawFromAave(address token, uint256 id) public override returns (uint256 amountWithdrawn) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        require(
            Storage.aaveUserReserves[token].positionShares[id] > 0,
            'PositionManager::removeAavePosition: no position to withdraw!'
        );

        uint256 amount = _getAmount(token, id);

        amountWithdrawn = ILendingPool(Storage.aaveAddressHolder.lendingPoolAddress()).withdraw(
            token,
            amount,
            address(this)
        );

        _removeAavePosition(token, id);
    }

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

    ///@notice remove awareness of aave position from positionManager
    ///@param token address of token withdrawn
    ///@param id of the withdrawn position
    function _removeAavePosition(address token, uint256 id) internal {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        uint256 length = Storage.aaveUserReserves[token].positionsId.length;
        uint256 i = 0;

        for (; i < length; i++) {
            if (Storage.aaveUserReserves[token].positionsId[i] == id) {
                if (length == 1) {
                    delete Storage.aaveUserReserves[token];
                } else {
                    Storage.aaveUserReserves[token].sharesEmitted -= Storage.aaveUserReserves[token].positionShares[id];
                    delete Storage.aaveUserReserves[token].positionShares[id];
                    Storage.aaveUserReserves[token].positionsId[i] = Storage.aaveUserReserves[token].positionsId[
                        length - 1
                    ];
                    Storage.aaveUserReserves[token].positionsId.pop();
                }
                i = length + 2;
            }
        }

        require(i == length + 2, 'PositionManager::removeAavePosition: position not found!');
    }
}
