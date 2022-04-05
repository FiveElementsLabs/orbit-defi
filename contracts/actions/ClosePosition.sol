// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import './BaseAction.sol';

import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '../../interfaces/IPositionManager.sol';
import '../../interfaces/IUniswapAddressHolder.sol';

contract ClosePosition {
    ///@notice uniswap address holder
    IUniswapAddressHolder public uniswapAddressHolder;

    ///@notice emitted when a UniswapNFT position is closed
    ///@param from address of PositionManager
    ///@param tokenId Id of the closed token
    event CloseUniPosition(address indexed from, uint256 tokenId);

    ///@notice input the decoder expects
    ///@param tokenId id of the token to close
    ///@param returnTokenToUser true if the token should be returned to the user
    struct InputStruct {
        uint256 tokenId;
        bool returnTokenToUser;
    }

    ///@notice output the encoder produces
    ///@param tokenId ID of the closed token
    ///@param token0Closed amount of token0 returned
    ///@param token1Closed amount of token1 returned
    struct OutputStruct {
        uint256 tokenId;
        uint256 token0Closed;
        uint256 token1Closed;
    }

    ///@notice executes the action of the contract (closePosition), should be the only function visible from the outside
    ///@param inputs input bytes to be decoded according to InputStruct
    ///@return outputs outputs encoded according OutputStruct
    function doAction(bytes memory inputs) public returns (OutputStruct memory outputs) {
        InputStruct memory inputsStruct = decodeInputs(inputs);
        outputs = closePosition(inputsStruct);
    }

    ///@notice close a UniswapV3 position NFT
    ///@param inputs input parameters needed to close the position
    ///@param outputs output parameters
    function closePosition(InputStruct memory inputs) internal returns (OutputStruct memory outputs) {
        INonfungiblePositionManager nonfungiblePositionManager = INonfungiblePositionManager(
            uniswapAddressHolder.nonfungiblePositionManagerAddress()
        );
        (, , , , , , , uint128 liquidity, , , , ) = nonfungiblePositionManager.positions(inputs.tokenId);

        INonfungiblePositionManager.DecreaseLiquidityParams memory decreaseliquidityparams = INonfungiblePositionManager
            .DecreaseLiquidityParams({
                tokenId: inputs.tokenId,
                liquidity: liquidity,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 1000
            });
        nonfungiblePositionManager.decreaseLiquidity(decreaseliquidityparams);

        (, , , , , , , , , , uint256 token0Closed, uint256 token1Closed) = nonfungiblePositionManager.positions(
            inputs.tokenId
        );

        INonfungiblePositionManager.CollectParams memory collectparams = INonfungiblePositionManager.CollectParams({
            tokenId: inputs.tokenId,
            recipient: inputs.returnTokenToUser ? msg.sender : address(this),
            amount0Max: 2**128 - 1,
            amount1Max: 2**128 - 1
        });
        nonfungiblePositionManager.collect(collectparams);

        nonfungiblePositionManager.burn(inputs.tokenId);

        //remove id from position manager array
        IPositionManager(address(this)).removePositionId(inputs.tokenId);

        //return the tokenId
        outputs = OutputStruct({tokenId: inputs.tokenId, token0Closed: token0Closed, token1Closed: token1Closed});

        //delete the position from the position manager
        emit CloseUniPosition(address(this), inputs.tokenId);
    }

    ///@notice decodes inputs to InputStruct
    ///@param inputBytes input bytes to be decoded
    ///@return input decoded input struct
    function decodeInputs(bytes memory inputBytes) internal pure returns (InputStruct memory input) {
        (uint256 tokenId, bool returnTokenToUser) = abi.decode(inputBytes, (uint256, bool));
        input = InputStruct({tokenId: tokenId, returnTokenToUser: returnTokenToUser});
    }
}
