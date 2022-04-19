// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import '@aave/protocol-v2/contracts/interfaces/ILendingPool.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../../interfaces/IAaveAddressHolder.sol';

import 'hardhat/console.sol';

contract AaveDeposit {
    ///@notice deposit to aave some token amount
    function depositToAave(
        address token,
        uint256 amount,
        address LendingPool
    ) public returns (bool) {
        //StorageStruct storage Storage = PositionManagerStorage.getStorage();
        /* ILendingPool LendingPool = ILendingPool(
            address(IAaveAddressHolder(Storage.aaveAddressHolder).lendingPoolAddress)
        ); */
        if (IERC20(token).allowance(address(this), address(LendingPool)) < amount) {
            IERC20(token).approve(address(LendingPool), 2**256 - 1);
        }

        ILendingPool(LendingPool).deposit(token, amount, address(this), 0);

        return true;
    }
}
