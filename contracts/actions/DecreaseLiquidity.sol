// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../helpers/ERC20Helper.sol';
import '../helpers/NFTHelper.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';

///@notice action to decrease liquidity of an NFT position
contract DecreaseLiquidity {
    IUniswapAddressHolder public uniswapAddressHolder;
    address public owner;

    ///@notice input the decoder expects
    ///@param tokenId the tokenId of the position
    ///@param amount0Desired the amount of token0 liquidity desired
    ///@param amount1Desired the amount of token1 liquidity desired
    struct InputStruct {
        uint256 tokenId;
        uint256 amount0Desired;
        uint256 amount1Desired;
    }

    ///@notice output the encoder produces
    ///@param liquidityToDecrease the amount of liquidity to decrease
    ///@param amount0 the amount of token0 removed
    ///@param amount1 the amount of token1 removed
    struct OutputStruct {
        uint128 liquidityToDecrease;
        uint256 amount0;
        uint256 amount1;
    }

    ///@notice executes the action of the contract (decrease liquidity), should be the only function visible from the outside
    ///@param inputs input bytes to be decoded according to InputStruct
    ///@return outputs outputs encoded according OutputStruct
    function doAction(bytes memory inputs) public returns (OutputStruct memory outputs) {
        InputStruct memory inputsStruct = decodeInputs(inputs);
        outputs = decreaseLiquidity(inputsStruct);
    }

    ///@notice decrease the liquidity of a V3 position
    ///@param inputs input parameters for minting
    ///@param outputs output parameters
    function decreaseLiquidity(InputStruct memory inputs) internal returns (OutputStruct memory outputs) {
        (, , , , , int24 tickLower, int24 tickUpper, uint128 liquidity, , , , ) = INonfungiblePositionManager(
            uniswapAddressHolder.nonfungiblePositionManagerAddress()
        ).positions(inputs.tokenId);

        IUniswapV3Pool pool = IUniswapV3Pool(
            NFTHelper._getPoolFromTokenId(
                inputs.tokenId,
                INonfungiblePositionManager(uniswapAddressHolder.nonfungiblePositionManagerAddress()),
                uniswapAddressHolder.uniswapV3FactoryAddress()
            )
        );

        (uint160 sqrtRatioX96, , , , , , ) = pool.slot0();

        uint128 liquidityToDecrease = LiquidityAmounts.getLiquidityForAmounts(
            sqrtRatioX96,
            TickMath.getSqrtRatioAtTick(tickLower),
            TickMath.getSqrtRatioAtTick(tickUpper),
            inputs.amount0Desired,
            inputs.amount1Desired
        );

        ///@dev remove all liquidity if the amount to decrease is greater than the amount in the pool
        if (liquidityToDecrease > liquidity) {
            liquidityToDecrease = liquidity;
        }

        INonfungiblePositionManager.DecreaseLiquidityParams memory decreaseliquidityparams = INonfungiblePositionManager
            .DecreaseLiquidityParams({
                tokenId: inputs.tokenId,
                liquidity: liquidityToDecrease,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 1000
            });

        (address token0Address, address token1Address) = NFTHelper._getTokenAddress(
            inputs.tokenId,
            INonfungiblePositionManager(uniswapAddressHolder.nonfungiblePositionManagerAddress())
        );

        ERC20Helper._approveToken(token0Address, uniswapAddressHolder.nonfungiblePositionManagerAddress(), 2**256 - 1);
        ERC20Helper._approveToken(token1Address, uniswapAddressHolder.nonfungiblePositionManagerAddress(), 2**256 - 1);

        (uint256 amount0, uint256 amount1) = INonfungiblePositionManager(
            uniswapAddressHolder.nonfungiblePositionManagerAddress()
        ).decreaseLiquidity(decreaseliquidityparams);

        outputs = OutputStruct({liquidityToDecrease: liquidityToDecrease, amount0: amount0, amount1: amount1});
    }

    ///@notice decodes inputs to InputStruct
    ///@param inputBytes input bytes to be decoded
    ///@return input decoded input struct
    function decodeInputs(bytes memory inputBytes) internal pure returns (InputStruct memory input) {
        (uint256 tokenId, uint256 amount0Desired, uint256 amount1Desired) = abi.decode(
            inputBytes,
            (uint256, uint256, uint256)
        );
        input = InputStruct({tokenId: tokenId, amount0Desired: amount0Desired, amount1Desired: amount1Desired});
    }
}
