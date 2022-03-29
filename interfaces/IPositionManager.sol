// SPDX-License-Identifier: Unlicense

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IPositionManager {
    function depositUniNft(address from, uint256[] calldata tokenId) external;

    function withdrawUniNft(address to, uint256 tokenId) external;

    function withdrawAllUniNft(address to) external;

    function mintAndDeposit(
        INonfungiblePositionManager.MintParams[] memory mintParams,
        bool _usingPositionManagerBalance
    ) external;

    function getPositionBalance(uint256 tokenId) external view returns (uint256, uint256);

    function getPositionFee(uint256 tokenId) external view returns (uint128 tokensOwed0, uint128 tokensOwed1);

    function closeUniPositions(uint256[] memory tokenId, bool returnTokensToUser) external payable;

    function updateUncollectedFees(uint256 tokenId) external;

    function collectPositionFee(uint256 tokenId, address recipient) external returns (uint256 amount0, uint256 amount1);

    function increasePositionLiquidity(
        uint256 tokenId,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) external payable returns (uint256 amount0, uint256 amount1);

    function decreasePositionLiquidity(
        uint256 tokenId,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) external payable;

    function swap(
        IERC20 token0,
        IERC20 token1,
        uint24 fee,
        uint256 amount0In,
        bool _usingPositionManagerBalance
    ) external returns (uint256 amount1Out);

    function swapToPositionRatio(
        IERC20 token0,
        IERC20 token1,
        uint24 fee,
        uint256 amount0In,
        uint256 amount1In,
        int24 tickLower,
        int24 tickUpper,
        bool _usingPositionManagerBalance
    ) external returns (uint256 amountOut);

    function _getAllUniPosition() external view returns (uint256[] memory);
}