// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '../utils/Storage.sol';

interface ICollectFees {
    function collectFees(uint256 tokenId) external returns (uint256 amount0, uint256 amount1);
}

///@notice collect fees from a uniswapV3 position
contract CollectFees {
    ///@notice emitted upon collect fees of a UniswapV3 position
    ///@param amount0 amount of token0 collected
    ///@param amount1 amount of token1 collected
    event feesCollected(uint256 amount0, uint256 amount1);

    ///@notice collect fees from a uniswapV3 position
    ///@param tokenId of token to collect fees from
    ///@return amount0 of token0 collected
    ///@return amount1 of token1 collected
    function collectFees(uint256 tokenId) public returns (uint256 amount0, uint256 amount1) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        _updateUncollectedFees(tokenId);

        INonfungiblePositionManager nonfungiblePositionManager = INonfungiblePositionManager(
            Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress()
        );
        (, , , , , , , , , , uint128 feesToken0, uint128 feesToken1) = nonfungiblePositionManager.positions(tokenId);

        INonfungiblePositionManager.CollectParams memory params = INonfungiblePositionManager.CollectParams({
            tokenId: tokenId,
            recipient: address(this),
            amount0Max: feesToken0,
            amount1Max: feesToken1
        });

        (amount0, amount1) = nonfungiblePositionManager.collect(params);
        emit feesCollected(amount0, amount1);
    }

    ///@notice update the uncollected fees of a uniswapV3 position
    ///@param tokenId ID of the token to check fees from
    function _updateUncollectedFees(uint256 tokenId) internal {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        INonfungiblePositionManager.DecreaseLiquidityParams memory params = INonfungiblePositionManager
            .DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: 1,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 120
            });
        INonfungiblePositionManager(Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress()).decreaseLiquidity(
                params
            );
    }
}
