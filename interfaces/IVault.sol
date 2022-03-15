// SPDX-License-Identifier: Unlicense

pragma solidity 0.7.6;

interface IVault {
    function depositUniNft(address from, uint256[] calldata tokenId) external;

    function withdrawAllUniNft(address to) external;

    function getPositionBalance(uint256 tokenId) external view returns (uint256, uint256);

    function getPositionFee(uint256 tokenId) external view returns (uint128 tokensOwed0, uint128 tokensOwed1);

    function closeUniPosition(uint256 tokenId) external payable;

    function increasePositionLiquidity(
        uint256 tokenId,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) external payable returns (uint256 amount0, uint256 amount1);

    function _getAllUniPosition() external view returns (uint256[] memory);

    function collectPositionFee(uint256 tokenId) external returns (uint256 amount0, uint256 amount1);
}
