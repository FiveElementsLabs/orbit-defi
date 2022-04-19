pragma solidity ^0.6.11;

import '@aave/protocol-v2/contracts/protocol/lendingpool/LendingPool.sol';
import '@aave/protocol-v2/contracts/interfaces/ILendingPool.sol';
import 'hardhat/console.sol';

contract AaveModule {
    ///try deposit here
    /*
     function deposit(
    address asset,
    uint256 amount,
    address onBehalfOf,
    uint16 referralCode
    ) 
    */
    ILendingPool public LendingPool;

    constructor(address _lendingPool) public {
        LendingPool = ILendingPool(_lendingPool);
    }

    function depositToAave(address token0) public {
        IERC20(token0).approve(address(LendingPool), 1000000);

        LendingPool.deposit(token0, 1000, address(this), 0);
    }

    function withdrawToAave(address token0) public {
        LendingPool.withdraw(token0, 1000, address(this));
    }
}
