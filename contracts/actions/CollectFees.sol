// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../utils/Storage.sol';
import 'hardhat/console.sol';

interface ICollectFees {
    function collectFees(uint256 tokenId) external returns (uint256 amount0, uint256 amount1);
}

///@notice collect fees from a uniswapV3 position
contract CollectFees {
    ///@notice collect fees from a uniswapV3 position
    function collectFees(uint256 tokenId) public returns (uint256 amount0, uint256 amount1) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        console.log('called');
        console.log(address(this));
        console.log(Storage.owner);

        updateUncollectedFees(tokenId);
        console.log('1');
        INonfungiblePositionManager nonfungiblePositionManager = INonfungiblePositionManager(
            Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress()
        );
        (, , , , , , , , , , uint128 feesToken0, uint128 feesToken1) = nonfungiblePositionManager.positions(tokenId);
        console.log('2');
        INonfungiblePositionManager.CollectParams memory params = INonfungiblePositionManager.CollectParams({
            tokenId: tokenId,
            recipient: address(this),
            amount0Max: feesToken0,
            amount1Max: feesToken1
        });
        console.log('3');
        console.log(Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress());
        (amount0, amount1) = nonfungiblePositionManager.collect(params);
    }

    ///@notice update the uncollected fees of a uniswapV3 position
    ///@param tokenId ID of the token to check fees from
    function updateUncollectedFees(uint256 tokenId) internal {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        INonfungiblePositionManager.DecreaseLiquidityParams memory params = INonfungiblePositionManager
            .DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: 1,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 1000
            });
        INonfungiblePositionManager(Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress()).decreaseLiquidity(
                params
            );
    }
}
