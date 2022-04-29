// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import '../../interfaces/IAaveAddressHolder.sol';

contract AaveAddressHolder is IAaveAddressHolder {
    address public override lendingPoolAddress;

    constructor(address _lendingPoolAddress) {
        require(_lendingPoolAddress != address(0), 'AaveAddressHolder:lendingPoolAddress:: lendingPoolAddress is 0');
        lendingPoolAddress = _lendingPoolAddress;
    }

    ///@notice Set the address of the lending pool from aave
    ///@param newAddress The address of the lending pool from aave
    function setLendingPoolAddress(address newAddress) external override {
        require(newAddress != address(0), 'AaveAddressHolder:setLendingPoolAddress:: new lendingPoolAddress is 0');
        lendingPoolAddress = newAddress;
    }
}
