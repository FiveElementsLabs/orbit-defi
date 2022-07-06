// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '../helpers/SwapHelper.sol';
import '../helpers/UniswapNFTHelper.sol';
import '../helpers/ERC20Helper.sol';
import '../utils/Storage.sol';
import '../../interfaces/actions/ISwapToPositionRatio.sol';

///@notice action to swap to an exact position ratio
contract SwapToPositionRatio is ISwapToPositionRatio {
    using SafeMath for uint256;

    ///@notice emitted when a positionManager swaps to ratio
    ///@param positionManager address of PositionManager
    ///@param token0 address of first token of the pool
    ///@param token1 address of second token of the pool
    ///@param amount0Out token0 amount swapped
    ///@param amount1Out token1 amount swapped
    event SwappedToPositionRatio(
        address indexed positionManager,
        address token0,
        address token1,
        uint256 amount0Out,
        uint256 amount1Out
    );

    ///@notice performs swap to optimal ratio for the position at tickLower and tickUpper
    ///@param inputs struct containing the inputs for the swap
    ///@return amount0Out the new value of amount0
    ///@return amount1Out the new value of amount1
    function swapToPositionRatioV2(SwapToPositionInput memory inputs)
        public
        override
        returns (uint256 amount0Out, uint256 amount1Out)
    {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        uint256 amountToSwap;
        bool isToken0In;
        {
            IUniswapV3Pool pool = IUniswapV3Pool(
                UniswapNFTHelper._getPool(
                    Storage.uniswapAddressHolder.uniswapV3FactoryAddress(),
                    inputs.token0,
                    inputs.token1,
                    inputs.fee
                )
            );
            (, int24 tickPool, , , , , ) = pool.slot0();

            SwapHelper.checkDeviation(pool, Storage.registry.maxTwapDeviation(), Storage.registry.twapDuration());

            (amountToSwap, isToken0In) = SwapHelper.calcAmountToSwap(
                tickPool,
                inputs.tickLower,
                inputs.tickUpper,
                inputs.amount0,
                inputs.amount1
            );
        }

        if (amountToSwap != 0) {
            uint256 amountSwapped = _swap(
                isToken0In ? inputs.token0 : inputs.token1,
                isToken0In ? inputs.token1 : inputs.token0,
                inputs.fee,
                amountToSwap
            );

            ///@notice return the new amount of the token swapped and the token returned
            ///@dev token0AddressIn true amount 0 - amountToSwap  ------ amount 1 + amountSwapped
            ///@dev token0AddressIn false amount 0 + amountSwapped  ------ amount 1 - amountToSwap
            amount0Out = isToken0In ? inputs.amount0.sub(amountToSwap) : inputs.amount0.add(amountSwapped);
            amount1Out = isToken0In ? inputs.amount1.add(amountSwapped) : inputs.amount1.sub(amountToSwap);

            emit SwappedToPositionRatio(address(this), inputs.token0, inputs.token1, amount0Out, amount1Out);
        } else {
            amount0Out = inputs.amount0;
            amount1Out = inputs.amount1;
        }
    }

    ///@notice performs a swap
    ///@param tokenIn address of input token
    ///@param tokenOut address of output
    ///@param fee fee tier of the pool
    ///@param amountIn amount of tokenIn to swap
    function _swap(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn
    ) internal returns (uint256 amountOut) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        ISwapRouter swapRouter = ISwapRouter(Storage.uniswapAddressHolder.swapRouterAddress());

        ERC20Helper._approveToken(tokenIn, address(swapRouter), type(uint256).max);

        ISwapRouter.ExactInputSingleParams memory swapParams = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });

        amountOut = swapRouter.exactInputSingle(swapParams);
    }
}
