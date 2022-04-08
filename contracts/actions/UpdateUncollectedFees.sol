// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../utils/Storage.sol';

contract UpdateUncollectedFees {
    struct InputStruct {
        uint256 tokenId;
    }

    struct OutputStruct {
        uint256 uncollected0Fees;
        uint256 uncollected1Fees;
    }

    function updateUncollectedFeesV1(bytes memory inputs) public returns (OutputStruct memory outputs) {
        InputStruct memory inputStruct = decodeInputs(inputs);
        outputs = updateUncollectedFees(inputStruct);
    }

    function updateUncollectedFees(InputStruct memory inputs) internal returns (OutputStruct memory outputs) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        INonfungiblePositionManager nonfungiblePositionManager = INonfungiblePositionManager(
            Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress()
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
