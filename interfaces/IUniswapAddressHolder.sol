// SPDX-License-Identifier: Unlicense

pragma solidity 0.7.6;
pragma abicoder v2;

interface IUniswapAddressHolder {
    function nonfungiblePositionManagerAddress() external view returns (address);

    function uniswapV3FactoryAddress() external view returns (address);

    function swapRouterAddress() external view returns (address);

    function setNonFungibleAddress(address newAddress) external;

    function setFactoryAddress(address newAddress) external;

    function setSwapRouterAddress(address newAddress) external;
}
