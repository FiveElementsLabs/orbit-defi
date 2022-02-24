// SPDX-License-Identifier: Unlicense

pragma solidity 0.7.6;

import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3MintCallback.sol";
import "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import "@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol";
import "@uniswap/v3-periphery/contracts/libraries/PositionKey.sol";

/**
 * @title   Position Manager
 * @notice  A vault that provides liquidity on Uniswap V3.
 * @notice  User can Deposit here its Uni-v3 position
 * @notice  If user does so, he is sure that idle liquidity will always be employed in protocols
 * @notice  User will pay fee to external keepers
 * @notice  vault works for multiple positions
 */

contract PositionManager is
    IVault,
    IUniswapV3MintCallback,
    IUniswapV3SwapCallback,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Protocol fee to compensate keeper
    uint256 protocolfee = 1e6;
    // Array with list of UNI v3 positions
    uint256[] positionsArray;

    event DepositUniNft(
        address indexed from,
        uint256 tokenId
    );

    address public owner;

    /**
     * @dev After deploying, strategy needs to be set via `setStrategy()`
     */
    constructor(
        address userAddress
    ) {
        owner = userAddress;
    } 

    /**
     * @notice add uniswap position to the position manager
     */
    function depositUniNft(address from, uint256 tokenId) external {
        safeTransferFrom(from, address(this), tokenId, 0);
        emit DepositUniNft(from, tokenId);
    }

    /** 
    function withdraw(
        uint256 shares,
        uint256 amount0Min,
        uint256 amount1Min,
        address to) external override nonReentrant returns (uint256 amount0, uint256 amount1) {
    }
    */
    
}
