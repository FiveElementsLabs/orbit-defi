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
    ///@notice withdraw from aave some token amount
    ///@param token token address
    ///@param amount amount to withdraw
    ///@param lendingPool address of the aave lending pool
    ///@return uint256 amount of token withdrawn from aave
    function withdrawFromAave(
        address token,
        uint256 amount,
        address lendingPool
    ) external override returns (uint256) {
        return ILendingPool(lendingPool).withdraw(token, amount, address(this));
    }
}
