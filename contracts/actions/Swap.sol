// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '../helpers/ERC20Helper.sol';
import '../helpers/SwapHelper.sol';
import '../helpers/UniswapNFTHelper.sol';
import '../utils/Storage.sol';
import '../../interfaces/actions/ISwap.sol';

contract Swap is ISwap {
    ///@notice emitted when a swap is performed
    ///@param positionManager address of the position manager which performed the swap
    ///@param tokenIn address of the token being swapped in
    ///@param tokenOut address of the token being swapped out
    ///@param amountIn amount of the token being swapped in
    ///@param amountOut amount of the token being swapped out
    event Swapped(
        address indexed positionManager,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    ///@notice check for twap oracle price manipulation
    ///@param token0Address address of the first token
    ///@param token1Address address of the second token
    ///@param fee pool fee level
    modifier checkDeviation(
        address token0Address,
        address token1Address,
        uint24 fee
    ) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        IUniswapV3Pool pool = IUniswapV3Pool(
            UniswapNFTHelper._getPool(
                Storage.uniswapAddressHolder.uniswapV3FactoryAddress(),
                token0Address,
                token1Address,
                fee
            )
        );

        SwapHelper.checkDeviation(pool, Storage.registry.maxTwapDeviation(), Storage.registry.twapDuration());
        _;
    }

    ///@notice swaps token0 for token1 on uniswap
    ///@param tokenIn address of first token
    ///@param tokenOut address of second token
    ///@param fee fee tier of the pool
    ///@param amountIn amount of token0 to swap
    ///@param returnTokensToOwner if true returns tokens to owner, if false leaves tokens in the position manager
    function swap(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        bool returnTokensToOwner
    ) external override checkDeviation(tokenIn, tokenOut, fee) returns (uint256 amountOut) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        ISwapRouter swapRouter = ISwapRouter(Storage.uniswapAddressHolder.swapRouterAddress());
        ERC20Helper._approveToken(tokenIn, address(swapRouter), type(uint256).max);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: returnTokensToOwner ? Storage.owner : address(this),
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });

        amountOut = swapRouter.exactInputSingle(params);
        emit Swapped(address(this), tokenIn, tokenOut, amountIn, amountOut);
    }
}
