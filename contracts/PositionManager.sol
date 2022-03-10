// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';
import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol';
import '@openzeppelin/contracts/token/ERC721/ERC721Holder.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
//import '@uniswap/v3-periphery/contracts/NonfungiblePositionManager.sol';
import 'hardhat/console.sol';
import '../interfaces/IVault.sol';

/**
 * @title   Position Manager
 * @notice  A vault that provides liquidity on Uniswap V3.
 * @notice  User can Deposit here its Uni-v3 position
 * @notice  If user does so, he is sure that idle liquidity will always be employed in protocols
 * @notice  User will pay fee to external keepers
 * @notice  vault works for multiple positions
 */

contract PositionManager is IVault, ERC721Holder {
    //
    INonfungiblePositionManager public immutable nonfungiblePositionManager;

    event DepositUni(address indexed from, uint256 tokenId);
    event WithdrawUni(address to, uint256 tokenId);

    address public owner;
    uint256[] private uniswapNFTs;

    /**
     * @dev After deploying, strategy needs to be set via `setStrategy()`
     */
    constructor(address userAddress, INonfungiblePositionManager _nonfungiblePositionManager) {
        owner = userAddress;
        nonfungiblePositionManager = _nonfungiblePositionManager;
    }

    // function approveNft(uint256 tokenId) external payable {
    //   setApprovalForAll(msg.sender, true); //msg.sender or contract(address) ?
    // }

    /**
     * @notice add uniswap position to the position manager
     */
    function depositUniNft(address from, uint256 tokenId) external override {
        nonfungiblePositionManager.safeTransferFrom(from, address(this), tokenId, '0x0');
        uniswapNFTs.push(tokenId);
        emit DepositUni(from, tokenId);
    }

    /**
     * @notice withdraw uniswap position from the position manager
     */
    function withdrawUniNft(address to, uint256 tokenId) public {
        //internal? users should not know id
        uint256 index = uniswapNFTs.length;
        for (uint256 i = 0; i < uniswapNFTs.length; i++) {
            if (uniswapNFTs[i] == tokenId) {
                index = i;
                i = uniswapNFTs.length;
            }
        }
        require(index < uniswapNFTs.length, 'token id not found!');
        nonfungiblePositionManager.safeTransferFrom(address(this), to, tokenId, '0x0');
        removeNFTFromList(index);
        emit WithdrawUni(to, tokenId);
    }

    //remove awareness of nft at index index
    function removeNFTFromList(uint256 index) internal {
        uniswapNFTs[index] = uniswapNFTs[uniswapNFTs.length - 1];
        uniswapNFTs.pop();
    }

    //wrapper for withdraw of all univ3positions in manager
    function withdrawAllUniNft(address to) external onlyUser {
        require(uniswapNFTs.length > 0, 'no NFT to withdraw');
        while (uniswapNFTs.length > 0) {
            this.withdrawUniNft(to, uniswapNFTs[0]);
        }
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
        require(msg.sender == owner, 'Only owner can call this function');
        _;
    }
}
//NonfungiblePositionManager.Position memory position = _positions[tokenId];
