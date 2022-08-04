// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

interface IPositionManager {
    struct ModuleInfo {
        bool isActive;
        bytes32 data;
    }

    struct AaveReserve {
        mapping(uint256 => uint256) positionShares;
        mapping(uint256 => uint256) tokenIds;
        uint256 sharesEmitted;
    }

    function toggleModule(
        uint256 tokenId,
        address moduleAddress,
        bool activated
    ) external;

    function setModuleData(
        uint256 tokenId,
        address moduleAddress,
        bytes32 data
    ) external;

    function getModuleInfo(uint256 _tokenId, address _moduleAddress)
        external
        view
        returns (bool isActive, bytes32 data);

    function withdrawERC20(address tokenAddress) external;

    function middlewareUniswap(uint256 tokenId, uint256 oldTokenId) external;

    function getAllUniPositions() external view returns (uint256[] memory);

    function getAaveDataFromTokenId(uint256 tokenId) external returns (uint256, address);

    function getOwner() external view returns (address);
}
