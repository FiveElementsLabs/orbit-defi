// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../helpers/NFTHelper.sol';

///@notice collect fees from a uniswapV3 position
contract CollectFees {
    IUniswapAddressHolder public uniswapAddressHolder;

    ///@notice input the decoder expects
    ///@param tokenId ID of the token to collect fees from
    struct InputStruct {
        uint256 tokenId;
    }

    ///@notice output struct returned by the contract
    ///@param amount0 amount0 collected
    ///@param amount1 amount1 collected
    struct OutputStruct {
        uint256 amount0;
        uint256 amount1;
    }

    ///@notice executes the action of the contract (collect fees), should be the only function visible from the outside
    ///@param inputs input bytes to be decoded according to InputStruct
    ///@return outputs outputs encoded according OutputStruct
    function doAction(bytes memory inputs) public returns (OutputStruct memory outputs) {
        InputStruct memory inputStruct = decodeInputs(inputs);
        outputs = collectFees(inputStruct);
    }

    ///@notice collect fees from a uniswapV3 position
    ///@param inputStruct input parameters for collecting fees
    ///@return outputs struct of outputs
    function collectFees(InputStruct memory inputStruct) internal returns (OutputStruct memory outputs) {
        updateUncollectedFees(inputStruct.tokenId);
        INonfungiblePositionManager nonfungiblePositionManager = INonfungiblePositionManager(
            uniswapAddressHolder.nonfungiblePositionManagerAddress()
        );
        (, , , , , , , , , , uint128 feesToken0, uint128 feesToken1) = nonfungiblePositionManager.positions(
            inputStruct.tokenId
        );
        INonfungiblePositionManager.CollectParams memory params = INonfungiblePositionManager.CollectParams({
            tokenId: inputStruct.tokenId,
            recipient: address(this),
            amount0Max: feesToken0,
            amount1Max: feesToken1
        });
        (uint256 amount0, uint256 amount1) = nonfungiblePositionManager.collect(params);
        outputs = OutputStruct({amount0: amount0, amount1: amount1});
    }

    ///@notice update the uncollected fees of a uniswapV3 position
    ///@param tokenId ID of the token to check fees from
    function updateUncollectedFees(uint256 tokenId) internal {
        INonfungiblePositionManager.DecreaseLiquidityParams memory params = INonfungiblePositionManager
            .DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: 1,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 1000
            });
        INonfungiblePositionManager(uniswapAddressHolder.nonfungiblePositionManagerAddress()).decreaseLiquidity(params);
    }

    ///@notice decodes the input bytes according to InputStruct
    ///@param inputBytes input bytes to be decoded
    ///@return inputStruct decoded according to InputStruct
    function decodeInputs(bytes memory inputBytes) internal pure returns (InputStruct memory inputStruct) {
        inputStruct = InputStruct({tokenId: abi.decode(inputBytes, (uint256))});
    }
}
