// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import '../../interfaces/ILendingPool.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IAaveDeposit {
    ///@notice deposit to aave some token amount
    ///@param token token address
    ///@param amount amount to deposit
    ///@param lendingPool address of the aave lending pool
    function depositToAave(
        address token,
        uint256 amount,
        address lendingPool
    ) external;
}

///@notice action to deposit tokens into aave protocol
contract AaveDeposit is IAaveDeposit {
    ///@notice emitted when a deposit on aave is made
    ///@param positionManager address of aave positionManager which deposited
    ///@param token token address
    ///@param amount amount deposited
    event AaveDepositEvent(address indexed positionManager, address token, uint256 amount);

    ///@notice deposit to aave some token amount
    ///@param token token address
    ///@param amount amount to deposit
    ///@param lendingPool address of the aave lending pool
    function depositToAave(
        address token,
        uint256 amount,
        address lendingPool
    ) public override {
        if (IERC20(token).allowance(address(this), lendingPool) < amount) {
            IERC20(token).approve(lendingPool, 2**256 - 1);
        }

        ILendingPool(lendingPool).deposit(token, amount, address(this), 0);
        emit AaveDepositEvent(address(this), token, amount);
    }
}
