// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../helpers/ERC20Helper.sol';
import '../helpers/NFTHelper.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';

///@notice action to increase the liquidity of a V3 position
contract IncreaseLiquidity {
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
    ///@param amount0 the amount of actual token0 liquidity
    ///@param amount1 the amount of actual token1 liquidity
    struct OutputStruct {
        uint256 amount0;
        uint256 amount1;
    }

    ///@notice executes the action of the contract (increase liquidity), should be the only function visible from the outside
    ///@param inputs input bytes to be decoded according to InputStruct
    ///@return outputs outputs encoded according OutputStruct
    function doAction(bytes memory inputs) public returns (OutputStruct memory outputs) {
        InputStruct memory inputsStruct = decodeInputs(inputs);
        outputs = increaseLiquidity(inputsStruct);
    }

    ///@notice increases the liquidity of a V3 position
    ///@param inputs input parameters for minting
    ///@param outputs output parameters
    function increaseLiquidity(InputStruct memory inputs) internal returns (OutputStruct memory outputs) {
        require(inputs.amount0Desired > 0 || inputs.amount1Desired > 0, 'send some tokens to increase liquidity');

        (address token0Address, address token1Address) = NFTHelper._getTokenAddress(
            inputs.tokenId,
            INonfungiblePositionManager(uniswapAddressHolder.nonfungiblePositionManagerAddress())
        );

        ERC20Helper._approveToken(token0Address, uniswapAddressHolder.nonfungiblePositionManagerAddress(), 2**256 - 1);
        ERC20Helper._approveToken(token1Address, uniswapAddressHolder.nonfungiblePositionManagerAddress(), 2**256 - 1);

        IERC20 token0 = IERC20(token0Address);
        IERC20 token1 = IERC20(token1Address);

        token0.transferFrom(msg.sender, address(this), inputs.amount0Desired);
        token1.transferFrom(msg.sender, address(this), inputs.amount1Desired);

        INonfungiblePositionManager.IncreaseLiquidityParams memory params = INonfungiblePositionManager
            .IncreaseLiquidityParams({
                tokenId: inputs.tokenId,
                amount0Desired: inputs.amount0Desired,
                amount1Desired: inputs.amount1Desired,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 1000
            });

        (, uint256 amount0, uint256 amount1) = INonfungiblePositionManager(
            uniswapAddressHolder.nonfungiblePositionManagerAddress()
        ).increaseLiquidity(params);

        if (amount0 < inputs.amount0Desired) token0.transfer(owner, inputs.amount0Desired - amount0);
        if (amount1 < inputs.amount1Desired) token1.transfer(owner, inputs.amount1Desired - amount1);

        outputs = OutputStruct({amount0: amount0, amount1: amount1});
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
