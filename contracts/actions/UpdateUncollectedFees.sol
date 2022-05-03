// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../utils/Storage.sol';

interface IUpdateUncollectedFees {
    function updateUncollectedFees(uint256 tokenId) external returns (uint256, uint256);
}

contract UpdateUncollectedFees is IUpdateUncollectedFees {
    ///@notice emitted when a UniswapNFT position is updated
    ///@param positionManager address of PositionManager
    ///@param tokenId Id of the updated position
    ///@param token0 fee collected
    ///@param token1 fee collected
    event updateFees(address indexed positionManager, uint256 tokenId, uint256 token0, uint256 token1);

    ///@notice update the uncollected fees of a UniswapV3 position NFT
    ///@param tokenId ID of the NFT
    ///@return uint256 token0 fee collected
    ///@return uint256 token1 fee collected
    function updateUncollectedFees(uint256 tokenId) public override returns (uint256, uint256) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        INonfungiblePositionManager nonfungiblePositionManager = INonfungiblePositionManager(
            Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress()
        );

        nonfungiblePositionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: 1,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 120
            })
        );

        (, , , , , , , , , , uint128 tokensOwed0, uint128 tokensOwed1) = nonfungiblePositionManager.positions(tokenId);
        emit updateFees(address(this), tokenId, tokensOwed0, tokensOwed1);
        return (tokensOwed0, tokensOwed1);
    }
}
