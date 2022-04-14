// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

interface IPositionManagerFactory {
    function create(
        address _userAddress,
        address _diamondCutFacet,
        address _uniswapAddressHolderAddress
    ) external returns (address[] memory);

    function getAllPositionManagers() external view returns (address[] memory);

    function userToPositionManager(address _user) external view returns (address);
}
