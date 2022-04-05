// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '../../interfaces/IUniswapAddressHolder.sol';

contract CheckUncollectedFees {
    IUniswapAddressHolder public addressHolder;

    struct InputStruct {
        uint256 tokenId;
    }

    struct OutputStruct {
        uint256 uncollected0Fees;
        uint256 uncollected1Fees;
    }

    function doAction(bytes memory inputs) public returns (OutputStruct memory outputs) {
        InputStruct memory inputStruct = decodeInputs(inputs);
        outputs = checkUncollectedFees(inputStruct);
    }

    function checkUncollectedFees(InputStruct memory inputs) internal returns (OutputStruct memory outputs) {
        INonfungiblePositionManager nonfungiblePositionManager = INonfungiblePositionManager(
            addressHolder.nonfungiblePositionManagerAddress()
        );

        nonfungiblePositionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: inputs.tokenId,
                liquidity: 1,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 1000
            })
        );

        (, , , , , , , , , , uint128 tokensOwed0, uint128 tokensOwed1) = nonfungiblePositionManager.positions(
            inputs.tokenId
        );

        outputs = OutputStruct({uncollected0Fees: tokensOwed0, uncollected1Fees: tokensOwed1});
    }

    function decodeInputs(bytes memory inputBytes) internal pure returns (InputStruct memory inputsStruct) {
        inputsStruct = InputStruct({tokenId: abi.decode(inputBytes, (uint256))});
    }
}
