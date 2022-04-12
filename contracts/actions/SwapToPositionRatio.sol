// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '../helpers/SwapHelper.sol';
import '../helpers/NFTHelper.sol';
import '../helpers/ERC20Helper.sol';
import '../utils/Storage.sol';
import '../../interfaces/IUniswapAddressHolder.sol';

interface ISwapToPositionRatio {
    struct SwapToPositionInput {
        address token0Address;
        address token1Address;
        uint24 fee;
        uint256 amount0In;
        uint256 amount1In;
        int24 tickLower;
        int24 tickUpper;
    }

    function swapToPositionRatio(SwapToPositionInput memory inputs)
        external
        returns (uint256 amount0Out, uint256 amount1Out);
}

///@notice action to swap to an exact position ratio
contract SwapToPositionRatio {
    event SwapToPositionRatioEvent(uint256 amount0Out, uint256 amount1Out);

    ///@notice input the decoder expects
    ///@param token0Address address of first token of the pool
    ///@param token1Address address of second token of the pool
    ///@param fee fee tier of the pool
    ///@param amount0In actual token0 amount to be deposited
    ///@param amount1In actual token1 amount to be deposited
    ///@param tickLower lower tick of position
    ///@param tickUpper upper tick of position
    struct SwapToPositionInput {
        address token0Address;
        address token1Address;
        uint24 fee;
        uint256 amount0In;
        uint256 amount1In;
        int24 tickLower;
        int24 tickUpper;
    }

    ///@notice performs swap to optimal ratio for the position at tickLower and tickUpper
    ///@param inputs input bytes to be decoded according to SwapToPositionInput
    ///@param amount0Out the new value of amount0
    ///@param amount1Out the new value of amount1
    function swapToPositionRatio(SwapToPositionInput memory inputs)
        public
        returns (uint256 amount0Out, uint256 amount1Out)
    {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        address poolAddress = NFTHelper._getPoolAddress(
            Storage.uniswapAddressHolder.uniswapV3FactoryAddress(),
            inputs.token0Address,
            inputs.token1Address,
            inputs.fee
        );
        IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
        (, int24 tickPool, , , , , ) = pool.slot0();
        (uint256 amountToSwap, bool token0AddressIn) = SwapHelper.calcAmountToSwap(
            tickPool,
            inputs.tickLower,
            inputs.tickUpper,
            inputs.amount0In,
            inputs.amount1In
        );

        if (amountToSwap != 0) {
            uint256 amountSwapped = swap(
                token0AddressIn ? inputs.token0Address : inputs.token1Address,
                token0AddressIn ? inputs.token1Address : inputs.token0Address,
                inputs.fee,
                amountToSwap
            );

            ///@notice return the new amount of the token swapped and the token returned
            ///@dev token0AddressIn true amount 0 - amountToSwap  ------ amount 1 + amountSwapped
            ///@dev token0AddressIn false amount 0 + amountSwapped  ------ amount 1 - amountToSwap
            amount0Out = token0AddressIn ? inputs.amount0In - amountToSwap : inputs.amount0In + amountSwapped;
            amount1Out = token0AddressIn ? inputs.amount1In + amountSwapped : inputs.amount1In - amountToSwap;
        } else {
            amount0Out = inputs.amount0In;
            amount1Out = inputs.amount1In;
        }
        emit SwapToPositionRatioEvent(amount0Out, amount1Out);
    }

    ///@notice swaps token0 for token1
    ///@param token0Address address of first token
    ///@param token1Address address of second token
    ///@param fee fee tier of the pool
    ///@param amount0In amount of token0 to swap
    function swap(
        address token0Address,
        address token1Address,
        uint24 fee,
        uint256 amount0In
    ) internal returns (uint256 amount1Out) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        ISwapRouter swapRouter = ISwapRouter(Storage.uniswapAddressHolder.swapRouterAddress());

        ERC20Helper._approveToken(token0Address, address(swapRouter), 2**256 - 1);
        ERC20Helper._approveToken(token1Address, address(swapRouter), 2**256 - 1);

        ISwapRouter.ExactInputSingleParams memory swapParams = ISwapRouter.ExactInputSingleParams({
            tokenIn: token0Address,
            tokenOut: token1Address,
            fee: fee,
            recipient: address(this),
            deadline: block.timestamp + 120,
            amountIn: amount0In,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });

        amount1Out = swapRouter.exactInputSingle(swapParams);
    }
}
