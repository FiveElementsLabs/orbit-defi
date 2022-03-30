// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import './BaseAction.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';

contract Swap is BaseAction {
    struct InputStruct {
        IERC20 token0;
        IERC20 token1;
        uint24 fee;
        uint256 amount0In;
    }

    struct OutputStruct {
        uint256 amount1Out;
    }

    //TODO: This should be in a helper.
    ISwapRouter public immutable swapRouter;

    constructor(ISwapRouter _swapRouter) {
        swapRouter = _swapRouter;
    }

    function doAction(bytes memory inputs) public override returns (bytes memory) {
        InputStruct memory inputsStruct = decodeInputs(inputs);
        OutputStruct memory outputsStruct = swap(inputsStruct);
        return encodeOutputs(outputsStruct);
    }

    function swap(InputStruct memory inputs) internal returns (OutputStruct memory outputs) {
        inputs.token0.approve(address(swapRouter), 2**256 - 1);

        ISwapRouter.ExactInputSingleParams memory swapParams = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(inputs.token0),
            tokenOut: address(inputs.token1),
            fee: inputs.fee,
            recipient: address(this),
            deadline: block.timestamp + 1000,
            amountIn: inputs.amount0In,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });

        uint256 amount1Out = swapRouter.exactInputSingle(swapParams);

        outputs = OutputStruct({amount1Out: amount1Out});
    }

    function decodeInputs(bytes memory inputBytes) internal pure returns (InputStruct memory input) {
        (IERC20 token0, IERC20 token1, uint24 fee, uint256 amount0In) = abi.decode(
            inputBytes,
            (IERC20, IERC20, uint24, uint256)
        );
        input = InputStruct({token0: token0, token1: token1, fee: fee, amount0In: amount0In});
    }

    function encodeOutputs(OutputStruct memory outputs) internal pure returns (bytes memory outputBytes) {
        outputBytes = abi.encode(outputs);
    }
}
