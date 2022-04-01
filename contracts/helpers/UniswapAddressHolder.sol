// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../../interfaces/IUniswapAddressHolder.sol';

contract UniswapAddressHolder is IUniswapAddressHolder {
    address public override nonfungiblePositionManagerAddress;
    address public override uniswapV3FactoryAddress;
    address public override swapRouterAddress;

    constructor(
        address _nonfungiblePositionManagerAddress,
        address _uniswapV3FactoryAddress,
        address _swapRouterAddress
    ) {
        nonfungiblePositionManagerAddress = _nonfungiblePositionManagerAddress;
        uniswapV3FactoryAddress = _uniswapV3FactoryAddress;
        swapRouterAddress = _swapRouterAddress;
    }

    function setNonFungibleAddress(address newAddress) external override {
        nonfungiblePositionManagerAddress = newAddress;
    }

    function setFactoryAddress(address newAddress) external override {
        uniswapV3FactoryAddress = newAddress;
    }

    function setSwapRouterAddress(address newAddress) external override {
        swapRouterAddress = newAddress;
    }
}
