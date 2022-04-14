// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../helpers/SwapHelper.sol';
import '../helpers/NFTHelper.sol';
import '../helpers/ERC20Helper.sol';

///@notice Zapper is a utility contract that allows user to enter/exit Uniswap V3 position with a single token
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

    ///@notice emitted when a NFT is minted
    ///@param tokenId the id of the minted NFT
    event MintedNFT(uint256 tokenId);

    ///@notice mints a uni NFT with a single input token, the token in input can be different from the two position tokens
    ///@param tokenIn address of input token
    ///@param amountIn amount of input token
    ///@param token0 address token0 of the pool
    ///@param token1 address token1 of the pool
    ///@param tickLower lower bound of desired position
    ///@param tickUpper upper bound of desired position
    ///@param fee fee tier of the pool
    ///@return tokenId of minted NFT
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

        ERC20Helper._pullTokensIfNeeded(tokenIn, msg.sender, amountIn);

        (, int24 tickPool, , , , , ) = IUniswapV3Pool(
            NFTHelper._getPoolAddress(uniswapAddressHolder.uniswapV3FactoryAddress(), token0, token1, fee)
        ).slot0();
        uint256 ratioE18 = SwapHelper.getRatioFromRange(tickPool, tickLower, tickUpper);
        uint256 amountInTo0 = (amountIn * 1e18) / (ratioE18 + 1e18);
        uint256 amountInTo1 = amountIn - amountInTo0;

        ERC20Helper._approveToken(tokenIn, address(swapRouter), amountIn);
        //if token in input is not the token0 of the pool, we need to swap it
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

        //if token in input is not the token1 of the pool, we need to swap it
        if (tokenIn != token1) {
            ERC20Helper._approveToken(tokenIn, address(swapRouter), amountIn);
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

        ERC20Helper._approveToken(token0, address(nonfungiblePositionManager), amountInTo0);
        ERC20Helper._approveToken(token1, address(nonfungiblePositionManager), amountInTo1);
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
        emit MintedNFT(tokenId);
    }

    ///@notice burns a uni NFT with a single output token, the output token can be different from the two position tokens
    ///@param tokenId id of the NFT to burn
    ///@param tokenOut address of output token
    function zapOut(uint256 tokenId, address tokenOut) public {
        (address token0, address token1) = NFTHelper._getTokenAddress(tokenId, nonfungiblePositionManager);

        (, , , , , , , uint128 liquidity, , , , ) = nonfungiblePositionManager.positions(tokenId);

        nonfungiblePositionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: liquidity,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 1
            })
        );

        (uint256 amount0, uint256 amount1) = nonfungiblePositionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: 2**128 - 1,
                amount1Max: 2**128 - 1
            })
        );

        nonfungiblePositionManager.burn(tokenId);

        if (tokenOut != token0) {
            amount0 = _swapToTokenOut(tokenOut, token0, amount0);
        }

        if (tokenOut != token1) {
            amount1 = _swapToTokenOut(tokenOut, token1, amount1);
        }

        ERC20Helper._approveToken(tokenOut, address(this), amount0 + amount1);
        ERC20Helper._withdrawTokens(tokenOut, msg.sender, amount0 + amount1);
    }

    function _swapToTokenOut(
        address tokenOut,
        address tokenIn,
        uint256 amountIn
    ) internal returns (uint256 amountOut) {
        ERC20Helper._approveToken(tokenIn, address(swapRouter), amountIn);

        amountOut = swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: _findBestFee(tokenIn, tokenOut),
                recipient: address(this),
                deadline: block.timestamp + 1,
                amountIn: amountIn,
                amountOutMinimum: 1,
                sqrtPriceLimitX96: 0
            })
        );
    }

    ///@notice orders token addresses
    ///@param token0 address of token0
    ///@param token1 address of token1
    ///@return address first token address
    ///@return address second token address
    function _reorderTokens(address token0, address token1) internal pure returns (address, address) {
        if (token0 > token1) {
            return (token1, token0);
        } else {
            return (token0, token1);
        }
    }

    ///@notice finds the best fee tier on which to perform a swap
    ///@param token0 address of first token
    ///@param token1 address of second token
    ///@return fee suggested fee tier
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
                //pass
            }
        }

        if (bestLiquidity == 0) {
            revert('No pool found');
        }
    }

    ///@notice wrapper of getPoolLiquidity to use try/catch statement
    ///@param token0 address of first token
    ///@param token1 address of second token
    ///@param fee pool fee tier
    ///@return liquidity of the pool
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