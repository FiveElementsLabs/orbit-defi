// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IAaveAddressHolder {
    ///@notice default getter for lendingPoolAddress
    ///@return address The address of the lending pool from aave
    function lendingPoolAddress() external view returns (address);

    ///@notice Set the address of lending pool
    ///@param newAddress new address of the lending pool from aave
    function setLendingPoolAddress(address newAddress) external;
}
