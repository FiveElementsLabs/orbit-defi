// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import '@aave/protocol-v2/contracts/interfaces/ILendingPool.sol';

interface IAaveWithdraw {
    ///@notice withdraw from aave some token amount
    ///@param token token address
    ///@param amount amount to withdraw
    ///@param lendingPool address of the aave lending pool
    ///@return uint256 amount of token withdrawn from aave
    function withdrawFromAave(
        address token,
        uint256 amount,
        address lendingPool
    ) external returns (uint256);
}

///@notice action to withdraw tokens from aave protocol
contract AaveWithdraw is IAaveWithdraw {
    ///@notice emitted when a withdraw from aave is made
    ///@param positionManager address of aave positionManager which withdrew
    ///@param token token address
    ///@param amount amount withdrawn
    event AaveDepositEvent(address indexed positionManager, address token, uint256 amount );

    ///@notice withdraw from aave some token amount
    ///@param token token address
    ///@param amount amount to withdraw
    ///@param lendingPool address of the aave lending pool
    ///@return uint256 amount of token withdrawn from aave
    function withdrawFromAave(
        address token,
        uint256 amount,
        address lendingPool
    ) public override returns (uint256 amountWithdrawn) {
        amountWithdrawn = ILendingPool(lendingPool).withdraw(token, amount, address(this));
        emint AaveDepositEvent(address(this), token, amountWithdrawn);
    }
}
