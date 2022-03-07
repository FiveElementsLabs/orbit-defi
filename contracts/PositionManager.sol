// SPDX-License-Identifier: Unlicense

pragma solidity 0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "../interfaces/IVault.sol";
import "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";

/**
 * @title   Position Manager
 * @notice  A vault that provides liquidity on Uniswap V3.
 * @notice  User can Deposit here its Uni-v3 position
 * @notice  If user does so, he is sure that idle liquidity will always be employed in protocols
 * @notice  User will pay fee to external keepers
 * @notice  vault works for multiple positions
 */

contract PositionManager is IVault, ERC1155 {
    // Protocol fee to compensate keeper
    uint256 protocolfee = 1e6;
    // Array with list of UNI v3 positions
    uint256[] positionsArray;

    event DepositUni(address indexed from, uint256 tokenId);

    address public owner;

    /**
     * @dev After deploying, strategy needs to be set via `setStrategy()`
     */
    constructor(address userAddress) ERC1155("www.google.com") {
        owner = userAddress;
    }

    /* function approveNft (uint256 tokenId) external payable {
        approve(msg.sender, tokenId);  //msg.sender or contract(address) ?
    } */

    /**
     * @notice add uniswap position to the position manager
     */
    function depositUniNft(
        address from,
        uint256 tokenId,
        uint256 amount
    ) external override {
        safeTransferFrom(from, address(this), tokenId, amount, "0x0");
        emit DepositUni(from, tokenId);
    }

    /**
     * @notice get balance token0 and token1 in a position
     */
    /* function getPositionBalance(uint256 tokenId) external view returns(uint128 tokensOwed0, uint128 tokensOwed1) {
        (,,,,,,,,,,tokensOwed0,tokensOwed1) = this.positions(tokenId);
    } */

    /* function getPositionFee(uint256 tokenId) external view returns(uint256 tokensOwed0, uint256 tokensOwed1) {
        (,,,,,,,,,,tokensOwed0,tokensOwed1) = this.positions(tokenId);

    } */

    /**
     * @notice close and burn uniswap position; tokenId need to be approved
     */
    /* function closeUniPosition(uint256 tokenId) external view {
        this.burn(tokenId);
    } */

    /* function collectPositionFee(uint256 tokenId) external view returns (uint256 amount0, uint256 amount1) {
        INonfungiblePositionManager.CollectParams memory params = 
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: owner,
                amount0Max: 0,
                amount1Max: 1
            });

        (amount0, amount1) = this.collect(params);
    } */

    /* function increasePositionLiquidity(
        uint256 tokenId, 
        uint256 amount0Desired, 
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min,
        uint256 deadline
        ) external payable returns (uint256 amount0Desired, uint256 amount1Desired) {
        INonfungiblePositionManager.IncreaseLiquidityParams memory params =
            INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: tokenId,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: amount0Min,
                amount1Min: amount1Min,
                deadline: deadline
            });
        this.increaseLiquidity(params);
    } */

    modifier onlyUser() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
}
//NonfungiblePositionManager.Position memory position = _positions[tokenId];
