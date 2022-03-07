// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import '@openzeppelin/contracts/math/Math.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol';
import '@uniswap/v3-periphery/contracts/libraries/PositionKey.sol';
import '../interfaces/IVault.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';

/**
 * @title   Position Manager
 * @notice  A vault that provides liquidity on Uniswap V3.
 * @notice  User can Deposit here its Uni-v3 position
 * @notice  If user does so, he is sure that idle liquidity will always be employed in protocols
 * @notice  User will pay fee to external keepers
 * @notice  vault works for multiple positions
 */

contract PositionManager is IVault, ERC1155, ReentrancyGuard {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  // Protocol fee to compensate keeper
  uint256 protocolfee = 1e6;
  // Array with list of UNI v3 positions
  uint256[] positionsArray;

  event DepositUni(address indexed from, uint256 tokenId);

  address public owner;

  /**
   * @dev After deploying, strategy needs to be set via `setStrategy()`
   */
  constructor(address userAddress) ERC1155('https://www.google.com') {
    owner = userAddress;
  }

  /**
   * @notice add uniswap position to the position manager
   */
  function depositUniNft(
    address from,
    uint256 tokenId,
    uint256 amount
  ) external override {
    safeTransferFrom(from, address(this), tokenId, amount, '0x0');
    emit DepositUni(from, tokenId);
  }
}
