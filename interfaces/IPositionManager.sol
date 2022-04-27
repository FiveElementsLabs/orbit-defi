// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

interface IPositionManager {
    function getModuleState(uint256 tokenId, address moduleAddress) external view returns (bool);

    function toggleModule(
        uint256 tokenId,
        address moduleAddress,
        bool activated
    ) external;

    function withdrawERC20(address tokenAddress) external;

    function removePositionId(uint256 index) external;

    function getAllUniPositions() external view returns (uint256[] memory);

    function pushPositionId(uint256 tokenId) external;

    function getOwner() external view returns (address);
}
