// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import '../../interfaces/ILendingPool.sol';
import '../helpers/ERC20Helper.sol';

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
    ///@notice deposit to aave some token amount
    ///@param token token address
    ///@param amount amount to deposit
    ///@param lendingPool address of the aave lending pool
    function depositToAave(
        address token,
        uint256 amount,
        address lendingPool
    ) public override {
        ERC20Helper._approveToken(token, lendingPool, amount);

        ILendingPool(lendingPool).deposit(token, amount, address(this), 0);
    }
}
