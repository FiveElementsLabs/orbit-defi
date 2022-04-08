// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IPositionManager {
    function depositUniNft(address from, uint256[] calldata tokenId) external;

    function withdrawUniNft(address to, uint256 tokenId) external;

    function getModuleState(uint256 tokenId, address moduleAddress) external view returns (bool);

    function toggleModule(
        uint256 tokenId,
        address moduleAddress,
        bool activated
    ) external;

    function removePositionId(uint256 index) external;

    //this function will need a modifier onlyModule
    function doAction(address actionAddress, bytes memory inputs) external returns (bytes memory outputs);

    function getAllUniPosition() external view returns (uint256[] memory);
}
