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

<<<<<<< HEAD
=======
    ///@notice Set the address of the non fungible position manager
    ///@param newAddress The address of the non fungible position manager
>>>>>>> fc13d0784c6639298715f645d45fe4372f2deb8e
    function setNonFungibleAddress(address newAddress) external override {
        nonfungiblePositionManagerAddress = newAddress;
    }

<<<<<<< HEAD
=======
    ///@notice Set the address of the Uniswap V3 factory
    ///@param newAddress The address of the Uniswap V3 factory
>>>>>>> fc13d0784c6639298715f645d45fe4372f2deb8e
    function setFactoryAddress(address newAddress) external override {
        uniswapV3FactoryAddress = newAddress;
    }

<<<<<<< HEAD
=======
    ///@notice Set the address of the swap router
    ///@param newAddress The address of the swap router
>>>>>>> fc13d0784c6639298715f645d45fe4372f2deb8e
    function setSwapRouterAddress(address newAddress) external override {
        swapRouterAddress = newAddress;
    }
}
