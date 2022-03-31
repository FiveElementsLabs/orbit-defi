// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import './BaseAction.sol';
import '../helpers/UniswapAddressHolder.sol';
import '../helpers/SwapHelper.sol';
import '../helpers/NFTHelper.sol';
import '../helpers/ERC20Helper.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

// These contracts should be imported from helpers.
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import 'hardhat/console.sol';

contract SwapToPositionRatio is BaseAction {
    event Output(bytes output);

    IUniswapAddressHolder public uniswapAddressHolder;

    struct InputStruct {
        address token0Address;
        address token1Address;
        uint24 fee;
        uint256 amount0In;
        uint256 amount1In;
        int24 tickLower;
        int24 tickUpper;
    }

    struct OutputStruct {
        uint256 amountOut;
    }

    constructor(address _uniswapAddressHolderAddress) {
        uniswapAddressHolder = IUniswapAddressHolder(_uniswapAddressHolderAddress);
    }

    function doAction(bytes memory inputs) public override returns (bytes memory outputs) {
        console.log('decode input');
        InputStruct memory inputsStruct = decodeInputs(inputs);
        console.log('swap');
        OutputStruct memory outputsStruct = swapToPositionRatio(inputsStruct);
        console.log('decode output');
        outputs = encodeOutputs(outputsStruct);
        emit Output(outputs);
    }

    function swapToPositionRatio(InputStruct memory inputs) internal returns (OutputStruct memory outputs) {
        console.log('uniswapAddressHolder: ', address(uniswapAddressHolder));
        address uniswapV3FactoryAddress = uniswapAddressHolder.uniswapV3FactoryAddress();
        console.log('pre library');
        // console.log('token0: ', inputs.token0Address);
        // console.log('token1: ', inputs.token1Address);

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
            uint256 amountOut = swap(
                token0AddressIn ? inputs.token0Address : inputs.token1Address,
                token0AddressIn ? inputs.token1Address : inputs.token0Address,
                inputs.fee,
                amountToSwap
            );

            outputs = OutputStruct({amountOut: amountOut});
        }
    }

    function swap(
        address token0Address,
        address token1Address,
        uint24 fee,
        uint256 amount0In
    ) internal returns (uint256 amount1Out) {
        ISwapRouter swapRouter = ISwapRouter(uniswapAddressHolder.swapRouterAddress());

        // ERC20Helper._approveToken(token0Address, address(swapRouter), amount0In);
        // token0.transferFrom(msg.sender, address(this), amount0In);

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

        console.log('Before exactInputSingle');
        amount1Out = swapRouter.exactInputSingle(swapParams);
        console.log(amount1Out);
    }

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

    function encodeOutputs(OutputStruct memory outputs) internal pure returns (bytes memory outputBytes) {
        outputBytes = abi.encode(outputs);
    }
}
