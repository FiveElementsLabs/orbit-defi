// SPDX-License-Identifier: Unlicense

pragma solidity 0.7.6;

import "OpenZeppelin/openzeppelin-contracts@3.4.0/contracts/math/SafeMath.sol";
import "OpenZeppelin/openzeppelin-contracts@3.4.0/contracts/token/ERC20/IERC20.sol";
import "OpenZeppelin/openzeppelin-contracts@3.4.0/contracts/token/ERC20/SafeERC20.sol";
import "OpenZeppelin/openzeppelin-contracts@3.4.0/contracts/token/ERC721/ERC721.sol";
import "OpenZeppelin/openzeppelin-contracts@3.4.0/contracts/token/ERC721/IERC721.sol";
import "OpenZeppelin/openzeppelin-contracts@3.4.0/contracts/token/ERC721/IERC721Metadata.sol";
import "Uniswap/uniswap-v3-periphery@1.0.0/contracts/interfaces/INonfungiblePositionManager.sol";
import "OpenZeppelin/openzeppelin-contracts@3.4.0/contracts/utils/ReentrancyGuard.sol";
import "Uniswap/uniswap-v3-core@1.0.0/contracts/interfaces/callback/IUniswapV3MintCallback.sol";
import "Uniswap/uniswap-v3-core@1.0.0/contracts/interfaces/callback/IUniswapV3SwapCallback.sol";
import "Uniswap/uniswap-v3-core@1.0.0/contracts/interfaces/IUniswapV3Pool.sol";
import "Uniswap/uniswap-v3-core@1.0.0/contracts/libraries/TickMath.sol";
import "Uniswap/uniswap-v3-periphery@1.0.0/contracts/libraries/LiquidityAmounts.sol";
import "Uniswap/uniswap-v3-periphery@1.0.0/contracts/libraries/PositionKey.sol";
import "../interfaces/IVault.sol";

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
