// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

contract UniswapAddressHolder {
    address public nonfungiblePositionManagerAddress;
    address public uniswapV3FactoryAddress;

    function setNonFungibleAddress(address newAddress) public {
        nonfungiblePositionManagerAddress = newAddress;
    }

    function setFactoryAddress(address newAddress) public {
        uniswapV3FactoryAddress = newAddress;
    }
}
