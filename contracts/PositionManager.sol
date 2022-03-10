// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC721/ERC721Holder.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
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
    event DepositUni(address indexed from, uint256 tokenId);
    event WithdrawUni(address to, uint256 tokenId);

    address public immutable owner;
    uint256[] private uniswapNFTs;

    // details about the uniswap position
    struct Position {
        // the nonce for permits
        uint96 nonce;
        // the address that is approved for spending this token
        address operator;
        // the ID of the pool with which this token is connected
        uint80 poolId;
        // the tick range of the position
        int24 tickLower;
        int24 tickUpper;
        // the liquidity of the position
        uint128 liquidity;
        // the fee growth of the aggregate position as of the last action on the individual position
        uint256 feeGrowthInside0LastX128;
        uint256 feeGrowthInside1LastX128;
        // how many uncollected tokens are owed to the position, as of the last computation
        uint128 tokensOwed0;
        uint128 tokensOwed1;
    }

    INonfungiblePositionManager public immutable nonfungiblePositionManager;

    /**
     * @dev After deploying, strategy needs to be set via `setStrategy()`
     */
    constructor(address userAddress, INonfungiblePositionManager _nonfungiblePositionManager) {
        owner = userAddress;
        nonfungiblePositionManager = _nonfungiblePositionManager;
    }

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
    /**
     * @notice get fee of token0 and token1 in a position
     */
    function getPositionFee(uint256 tokenId) external view returns (uint128 tokensOwed0, uint128 tokensOwed1) {
        (, , , , , , , , , , tokensOwed0, tokensOwed1) = nonfungiblePositionManager.positions(tokenId);
    }

    /**
     * @notice close and burn uniswap position; liquidity must be 0,
     */
    function closeUniPosition(uint256 tokenId) external payable {
        (, , , , , , , uint128 liquidity, , , , ) = nonfungiblePositionManager.positions(tokenId);

        INonfungiblePositionManager.DecreaseLiquidityParams memory decreaseliquidityparams = INonfungiblePositionManager
            .DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: liquidity,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 1000
            });
        nonfungiblePositionManager.decreaseLiquidity(decreaseliquidityparams);

        INonfungiblePositionManager.CollectParams memory collectparams = INonfungiblePositionManager.CollectParams({
            tokenId: tokenId,
            recipient: owner,
            amount0Max: 2**128 - 1,
            amount1Max: 2**128 - 1
        });
        nonfungiblePositionManager.collect(collectparams);

        nonfungiblePositionManager.burn(tokenId);
    }

    /**
     * @notice close and burn uniswap position; tokenId need to be approved
     */

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

    function increasePositionLiquidity(
        uint256 tokenId,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) external payable returns (uint256 amount0, uint256 amount1) {
        require(amount0Desired > 0 && amount1Desired > 0, 'send some token to increase liquidity');

        (IERC20 token0, IERC20 token1) = _getTokenAddress(tokenId);

        if (token0.allowance(address(this), address(nonfungiblePositionManager)) == 0) _approveToken0(token0);
        if (token1.allowance(address(this), address(nonfungiblePositionManager)) == 0) _approveToken1(token1);

        token0.transferFrom(msg.sender, address(this), amount0Desired);
        token1.transferFrom(msg.sender, address(this), amount1Desired);

        INonfungiblePositionManager.IncreaseLiquidityParams memory params = INonfungiblePositionManager
            .IncreaseLiquidityParams({
                tokenId: tokenId,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 1000
            });
        (, amount0, amount1) = nonfungiblePositionManager.increaseLiquidity(params);
    }

    function _approveToken0(IERC20 token0) private {
        token0.approve(address(nonfungiblePositionManager), 2**256 - 1);
    }

    function _approveToken1(IERC20 token1) private {
        token1.approve(address(nonfungiblePositionManager), 2**256 - 1);
    }

    function _getTokenAddress(uint256 tokenId) private view returns (IERC20 token0, IERC20 token1) {
        (, , address token0address, address token1address, , , , , , , , ) = nonfungiblePositionManager.positions(
            tokenId
        );
        token0 = IERC20(token0address);
        token1 = IERC20(token1address);
    }

    modifier onlyUser() {
        require(msg.sender == owner, 'Only owner can call this function');
        _;
    }
}
