// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';

interface IPositionManager {
    struct ModuleInfo {
        bool isActive;
        bytes data;
    }

    struct AaveReserve {
        mapping(uint256 => uint256) positionShares;
        mapping(uint256 => INonfungiblePositionManager.MintParams) uniPosition;
        uint256[] positionsId;
        uint256 sharesEmitted;
    }

    function getModuleState(uint256 tokenId, address moduleAddress) external view returns (bool);

    function toggleModule(
        uint256 tokenId,
        address moduleAddress,
        bool activated
    ) external;

    function setModuleData(
        uint256 tokenId,
        address moduleAddress,
        bytes memory data
    ) external;

    function getModuleData(uint256 tokenId, address moduleAddress) external view returns (bytes memory);

    function withdrawERC20(address tokenAddress) external;

    function getAllUniPositions() external view returns (uint256[] memory);

    function pushPositionId(uint256 tokenId) external;

    function removePositionId(uint256 index) external;

    function getOwner() external view returns (address);
}
