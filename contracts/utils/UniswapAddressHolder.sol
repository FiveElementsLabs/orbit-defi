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
        require(
            _nonfungiblePositionManagerAddress != address(0),
            'UniswapAddressHolder::nonfungiblePositionManagerAddress: nonfungiblePositionManagerAddress is 0'
        );
        require(
            _uniswapV3FactoryAddress != address(0),
            'UniswapAddressHolder::uniswapV3FactoryAddress: uniswapV3FactoryAddress is 0'
        );
        require(_swapRouterAddress != address(0), 'UniswapAddressHolder::swapRouterAddress: swapRouterAddress is 0');
        nonfungiblePositionManagerAddress = _nonfungiblePositionManagerAddress;
        uniswapV3FactoryAddress = _uniswapV3FactoryAddress;
        swapRouterAddress = _swapRouterAddress;
    }

    ///@notice Set the address of the non fungible position manager
    ///@param newAddress The address of the non fungible position manager
    function setNonFungibleAddress(address newAddress) external override {
        require(
            newAddress != address(0),
            'UniswapAddressHolder::setNonFungibleAddress: new nonfungiblePositionManagerAddress is 0'
        );
        nonfungiblePositionManagerAddress = newAddress;
    }

    ///@notice Set the address of the Uniswap V3 factory
    ///@param newAddress The address of the Uniswap V3 factory
    function setFactoryAddress(address newAddress) external override {
        require(newAddress != address(0), 'UniswapAddressHolder::setFactoryAddress: new uniswapV3FactoryAddress is 0');
        uniswapV3FactoryAddress = newAddress;
    }

    ///@notice Set the address of the swap router
    ///@param newAddress The address of the swap router
    function setSwapRouterAddress(address newAddress) external override {
        require(newAddress != address(0), 'UniswapAddressHolder::setSwapRouterAddress: new swapRouterAddress is 0');
        swapRouterAddress = newAddress;
    }
}
