// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import './BaseAction.sol';
import '../helpers/UniswapAddressHolder.sol';
import '../helpers/SwapHelper.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

// These contracts should be imported from helpers.
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

contract Swap is BaseAction, UniswapAddressHolder {
    event Output(bytes output);

    struct InputStruct {
        IERC20 token0;
        IERC20 token1;
        uint24 fee;
        uint256 amount0In;
        uint256 amount1In;
        int24 tickLower;
        int24 tickUpper;
    }

    struct OutputStruct {
        uint256 amountOut;
    }

    //TODO: This should be in a helper.
    ISwapRouter public immutable swapRouter;

    constructor(ISwapRouter _swapRouter) {
        swapRouter = _swapRouter;
    }

    function doAction(bytes memory inputs) public override returns (bytes memory outputs) {
        InputStruct memory inputsStruct = decodeInputs(inputs);
        OutputStruct memory outputsStruct = swapToPositionRatio(inputsStruct);
        outputs = encodeOutputs(outputsStruct);
        emit Output(outputs);
    }

    function swapToPositionRatio(InputStruct memory inputs) internal returns (OutputStruct memory outputs) {
        // TODO: Use helper to get pool.
        (, int24 tickPool, , , , , ) = getPool(address(inputs.token0), address(inputs.token1), inputs.fee).slot0();

        (uint256 amountToSwap, bool token0In) = SwapHelper.calcAmountToSwap(
            tickPool,
            inputs.tickLower,
            inputs.tickUpper,
            inputs.amount0In,
            inputs.amount1In
        );

        if (amountToSwap != 0) {
            amountOut = swap(
                token0In ? inputs.token0 : inputs.token1,
                token0In ? inputs.token1 : inputs.token0,
                inputs.fee,
                amountToSwap,
                true
            );
            outputs = OutputStruct({amountOut: amountOut});
        }
    }

    function swap(
        IERC20 token0,
        IERC20 token1,
        uint24 fee,
        uint256 amount0In
    ) internal returns (uint256 amount1Out) {
        token0.approve(address(swapRouter), 2**256 - 1);

        ISwapRouter.ExactInputSingleParams memory swapParams = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(token0),
            tokenOut: address(token1),
            fee: fee,
            recipient: address(this),
            deadline: block.timestamp + 1000,
            amountIn: amount0In,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });

        amount1Out = swapRouter.exactInputSingle(swapParams);
    }

    function decodeInputs(bytes memory inputBytes) internal pure returns (InputStruct memory input) {
        (
            IERC20 token0,
            IERC20 token1,
            uint24 fee,
            uint256 amount0In,
            uint256 amount1In,
            int24 tickLower,
            int24 tickUpper
        ) = abi.decode(inputBytes, (IERC20, IERC20, uint24, uint256, uint256, int24, int24));

        input = InputStruct({
            token0: token0,
            token1: token1,
            fee: fee,
            amount0In: amount0In,
            amount1In: amount1In,
            tickLower: tickLower,
            tickUpper: tickUpper
        });
    }

    function encodeOutputs(OutputStruct memory outputs) internal pure returns (bytes memory outputBytes) {
        outputBytes = abi.encode(outputs);
    }

    //TODO: when we have a helper, this function should be removed
    function getPool(
        address token0,
        address token1,
        uint24 fee
    ) public pure returns (IUniswapV3Pool) {
        PoolAddress.PoolKey memory key = PoolAddress.getPoolKey(token0, token1, fee);

        address poolAddress = PoolAddress.computeAddress(uniswapV3FactoryAddress, key);

        return IUniswapV3Pool(poolAddress);
    }
}
