// SPDX-License-Identifier: Unlicense

pragma solidity 0.7.6;
pragma abicoder v2;

interface IUniswapAddressHolder {
    function nonfungiblePositionManagerAddress() external returns (address);

    function uniswapV3FactoryAddress() external returns (address);

    function swapRouterAddress() external returns (address);

    function setNonFungibleAddress(address newAddress) external;

    function setFactoryAddress(address newAddress) external;

    function setSwapRouterAddress(address newAddress) external;
}
