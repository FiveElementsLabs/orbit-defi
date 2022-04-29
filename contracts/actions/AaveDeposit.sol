// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../../interfaces/ILendingPool.sol';
import '../../interfaces/IPositionManager.sol';
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
    ///@notice deposit to aave some token amount
    ///@param token token address
    ///@param amount amount to deposit
    ///@param lendingPoolAddress address of the aave lending pool
    function depositToAave(
        address token,
        uint256 amount,
        address lendingPoolAddress
    ) public override {
        ILendingPool lendingPool = ILendingPool(lendingPoolAddress);
        IERC20 aToken = IERC20(lendingPool.getReserveData(token).aTokenAddress);
        uint256 balanceBefore = aToken.balanceOf(address(this));

        if (IERC20(token).allowance(address(this), lendingPoolAddress) < amount) {
            IERC20(token).approve(lendingPoolAddress, 2**256 - 1);
        }

        lendingPool.deposit(token, amount, address(this), 0);
        uint256 balanceAfter = aToken.balanceOf(address(this));

        IPositionManager(address(this)).pushAavePosition(token, balanceAfter - balanceBefore);
    }
}
