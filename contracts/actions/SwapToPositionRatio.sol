// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '../helpers/SwapHelper.sol';
import '../helpers/NFTHelper.sol';
import '../helpers/ERC20Helper.sol';
import '../../interfaces/IUniswapAddressHolder.sol';

///@notice action to swap to an exact position ratio
contract SwapToPositionRatio {
    IUniswapAddressHolder public uniswapAddressHolder;

    ///@notice emitted to pass outputs to test file
    ///@param output output bytes
    event Output(bytes output);

    ///@notice input the decoder expects
    ///@param token0Address address of first token of the pool
    ///@param token1Address address of second token of the pool
    ///@param fee fee tier of the pool
    ///@param amount0In actual token0 amount to be deposited
    ///@param amount1In actual token1 amount to be deposited
    ///@param tickLower lower tick of position
    ///@param tickUpper upper tick of position
    struct InputStruct {
        address token0Address;
        address token1Address;
        uint24 fee;
        uint256 amount0In;
        uint256 amount1In;
        int24 tickLower;
        int24 tickUpper;
    }

    ///@notice output the encoder produces
    ///@param amount1Out token1 amount swapped
    struct OutputStruct {
        uint256 amount1Out;
    }

    constructor(address _uniswapAddressHolderAddress) {
        uniswapAddressHolder = IUniswapAddressHolder(_uniswapAddressHolderAddress);
    }

    ///@notice executes the action of the contract (swapToPositionRatio), should be the only function visible from the outside
    ///@param inputs input bytes to be decoded according to InputStruct
    ///@return outputs outputs encoded according OutputStruct
    function doAction(bytes memory inputs) public returns (OutputStruct memory outputs) {
        InputStruct memory inputsStruct = decodeInputs(inputs);
        outputs = swapToPositionRatio(inputsStruct);
        emit Output(encodeOutputs(outputs));
    }

    ///@notice performs swap to optimal ratio for the position at tickLower and tickUpper
    ///@param inputs input bytes to be decoded according to InputStruct
    ///@return outputs outputs encoded according OutputStruct
    function swapToPositionRatio(InputStruct memory inputs) internal returns (OutputStruct memory outputs) {
        address uniswapV3FactoryAddress = uniswapAddressHolder.uniswapV3FactoryAddress();

        address poolAddress = NFTHelper._getPoolAddress(
            uniswapV3FactoryAddress,
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
            uint256 amount1Out = swap(
                token0AddressIn ? inputs.token0Address : inputs.token1Address,
                token0AddressIn ? inputs.token1Address : inputs.token0Address,
                inputs.fee,
                amountToSwap
            );
            outputs = OutputStruct({amount1Out: amount1Out});
        }
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
        ISwapRouter swapRouter = ISwapRouter(uniswapAddressHolder.swapRouterAddress());

        ERC20Helper._approveToken(token0Address, address(swapRouter), 2**256 - 1);
        ERC20Helper._approveToken(token1Address, address(swapRouter), 2**256 - 1);

        ISwapRouter.ExactInputSingleParams memory swapParams = ISwapRouter.ExactInputSingleParams({
            tokenIn: token0Address,
            tokenOut: token1Address,
            fee: fee,
            recipient: address(this),
            deadline: block.timestamp + 1000,
            amountIn: amount0In,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });

        amount1Out = swapRouter.exactInputSingle(swapParams);
    }

    ///@notice decodes inputs to InputStruct
    ///@param inputBytes input bytes to be decoded
    ///@return input decoded input struct
    function decodeInputs(bytes memory inputBytes) internal pure returns (InputStruct memory input) {
        (
            address token0Address,
            address token1Address,
            uint24 fee,
            uint256 amount0In,
            uint256 amount1In,
            int24 tickLower,
            int24 tickUpper
        ) = abi.decode(inputBytes, (address, address, uint24, uint256, uint256, int24, int24));

        input = InputStruct({
            token0Address: token0Address,
            token1Address: token1Address,
            fee: fee,
            amount0In: amount0In,
            amount1In: amount1In,
            tickLower: tickLower,
            tickUpper: tickUpper
        });
    }

    ///@notice encode the outputs to bytes
    ///@param outputs outputs to be encoded
    ///@return outputBytes encoded outputs
    function encodeOutputs(OutputStruct memory outputs) internal pure returns (bytes memory outputBytes) {
        outputBytes = abi.encode(outputs, uint256(1));
    }
}
