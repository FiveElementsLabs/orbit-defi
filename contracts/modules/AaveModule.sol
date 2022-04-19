// SPDX-License-Identifier: MIT

pragma solidity ^0.6.11;

import '@aave/protocol-v2/contracts/interfaces/ILendingPool.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract AaveModule {
    ILendingPool public LendingPool;

    constructor(address _lendingPool) public {
        LendingPool = ILendingPool(_lendingPool);
    }

    function depositToAave(address token0) public {
        IERC20(token0).approve(address(LendingPool), 1000000);

        LendingPool.deposit(token0, 1000, address(this), 0);
    }

    function withdrawFromAave(address token0) public {
        LendingPool.withdraw(token0, 1000, address(this));
    }
}
