// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

//import inonfungiblepositionManager

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../helpers/SwapHelper.sol';
import '../helpers/NFTHelper.sol';
import '../helpers/ERC20Helper.sol';

contract Zapper {
    IUniswapAddressHolder public uniswapAddressHolder;
    ISwapRouter swapRouter;
    INonfungiblePositionManager nonfungiblePositionManager;

    constructor(address _uniswapAddressHolder) {
        uniswapAddressHolder = IUniswapAddressHolder(_uniswapAddressHolder);
        swapRouter = ISwapRouter(uniswapAddressHolder.swapRouterAddress());
        nonfungiblePositionManager = INonfungiblePositionManager(
            uniswapAddressHolder.nonfungiblePositionManagerAddress()
        );
    }

    function zapIn(
        address tokenIn,
        uint256 amountIn,
        address token0,
        address token1,
        int24 tickLower,
        int24 tickUpper,
        uint24 fee
    ) public returns (uint256 tokenId) {
        require(token0 != token1, 'token0 and token1 cannot be the same');
        (token0, token1) = _reorderTokens(token0, token1);

        address poolAddress = NFTHelper._getPoolAddress(
            uniswapAddressHolder.uniswapV3FactoryAddress(),
            token0,
            token1,
            fee
        );
        (, int24 tickPool, , , , , ) = IUniswapV3Pool(poolAddress).slot0();
        uint256 ratioE18 = SwapHelper.getRatioFromRange(tickPool, tickLower, tickUpper);
        uint256 amountInTo0 = (amountIn * 1e18) / (ratioE18 + 1e18);
        uint256 amountInTo1 = amountIn - amountInTo0;

        if (tokenIn != token0) {
            amountInTo0 = swapRouter.exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: token0,
                    fee: fee,
                    recipient: address(this),
                    deadline: block.timestamp + 1,
                    amountIn: amountInTo0,
                    amountOutMinimum: 1,
                    sqrtPriceLimitX96: 0
                })
            );
        }

        if (tokenIn != token1) {
            amountInTo1 = swapRouter.exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: token1,
                    fee: fee,
                    recipient: address(this),
                    deadline: block.timestamp + 1,
                    amountIn: amountInTo1,
                    amountOutMinimum: 1,
                    sqrtPriceLimitX96: 0
                })
            );
        }

        (tokenId, , , ) = nonfungiblePositionManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: fee,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: amountInTo0,
                amount1Desired: amountInTo1,
                amount0Min: 0,
                amount1Min: 0,
                recipient: msg.sender,
                deadline: block.timestamp + 1
            })
        );
    }

    function zapOut(uint256 tokenId, address tokenOut) public returns (uint256 amountOut) {
        (address token0, address token1) = NFTHelper._getTokenAddress(tokenId, nonfungiblePositionManager);

        nonfungiblePositionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: 2**128 - 1,
                amount0Min: 0,
                amount1Min: 1,
                deadline: block.timestamp + 1
            })
        );

        (uint256 amount0, uint256 amount1) = nonfungiblePositionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: msg.sender,
                amount0Max: 2**128 - 1,
                amount1Max: 2**128 - 1
            })
        );

        nonfungiblePositionManager.burn(tokenId);

        if (tokenOut != token0) {
            amount0 = swapRouter.exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: token0,
                    tokenOut: tokenOut,
                    fee: _findBestFee(token0, tokenOut),
                    recipient: address(this),
                    deadline: block.timestamp + 1,
                    amountIn: amount0,
                    amountOutMinimum: 1,
                    sqrtPriceLimitX96: 0
                })
            );
        }

        if (tokenOut != token1) {
            amount1 = swapRouter.exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: token1,
                    tokenOut: tokenOut,
                    fee: _findBestFee(tokenOut, token1),
                    recipient: address(this),
                    deadline: block.timestamp + 1,
                    amountIn: amount1,
                    amountOutMinimum: 1,
                    sqrtPriceLimitX96: 0
                })
            );
        }

        ERC20Helper._withdrawTokens(tokenOut, msg.sender, amount0 + amount1);
    }

    function _reorderTokens(address token0, address token1) internal pure returns (address, address) {
        if (token0 > token1) {
            return (token1, token0);
        } else {
            return (token0, token1);
        }
    }

    function _findBestFee(address token0, address token1) internal view returns (uint24 fee) {
        uint128 bestLiquidity = 0;
        uint16[4] memory fees = [100, 500, 3000, 10000];

        for (uint8 i = 0; i < 4; i++) {
            try this.getPoolLiquidity(token0, token1, uint24(fees[i])) returns (uint128 nextLiquidity) {
                if (nextLiquidity > bestLiquidity) {
                    bestLiquidity = nextLiquidity;
                    fee = fees[i];
                }
            } catch {
                // ignore
            }
        }
    }

    function getPoolLiquidity(
        address token0,
        address token1,
        uint24 fee
    ) public view returns (uint128 liquidity) {
        return
            IUniswapV3Pool(
                NFTHelper._getPoolAddress(uniswapAddressHolder.uniswapV3FactoryAddress(), token0, token1, fee)
            ).liquidity();
    }
}
