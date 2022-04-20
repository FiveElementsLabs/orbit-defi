// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import '../../interfaces/IAaveAddressHolder.sol';

contract AaveAddressHolder {
    address public lendingPoolAddress;

    constructor(address _lendingPoolAddress) public {
        lendingPoolAddress = _lendingPoolAddress;
    }

    ///@notice Set the address of the lending pool from aave
    ///@param newAddress The address of the lending pool from aave
    function setLendingPoolAddress(address newAddress) external {
        lendingPoolAddress = newAddress;
    }
}
