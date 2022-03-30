// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

contract UniswapAddressHolder {
    address public nonfungiblePositionManagerAddress = 0xc6e7DF5E7b4f2A278906862b61205850344D4e7d;
    address public uniswapV3FactoryAddress = 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9;

    function setNonFungibleAddress(address newAddress) public {
        nonfungiblePositionManagerAddress = newAddress;
    }

    function setFactoryAddress(address newAddress) public {
        uniswapV3FactoryAddress = newAddress;
    }
}
