// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '../utils/Storage.sol';
import '../../interfaces/IPositionManager.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../../interfaces/actions/IClosePosition.sol';

contract ClosePosition is IClosePosition {
    ///@notice emitted when a UniswapNFT position is closed
    ///@param positionManager address of PositionManager
    ///@param tokenId Id of the closed token
    event PositionClosed(address indexed positionManager, uint256 tokenId);

    ///@notice close a UniswapV3 position NFT
    ///@param tokenId id of the token to close
    ///@param returnTokenToUser true if the token should be returned to the user
    ///@return uint256 ID of the closed token
    ///@return uint256 amount of token0 returned
    ///@return uint256 amount of token1 returned
    function closePosition(uint256 tokenId, bool returnTokenToUser)
        external
        override
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        INonfungiblePositionManager nonfungiblePositionManager = INonfungiblePositionManager(
            Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress()
        );
        (, , , , , , , uint128 liquidity, , , , ) = nonfungiblePositionManager.positions(tokenId);
        if (liquidity != 0) {
            INonfungiblePositionManager.DecreaseLiquidityParams
                memory decreaseliquidityparams = INonfungiblePositionManager.DecreaseLiquidityParams({
                    tokenId: tokenId,
                    liquidity: liquidity,
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp
                });
            nonfungiblePositionManager.decreaseLiquidity(decreaseliquidityparams);
        }
        (, , , , , , , , , , uint128 token0Closed, uint128 token1Closed) = nonfungiblePositionManager.positions(
            tokenId
        );
        INonfungiblePositionManager.CollectParams memory collectparams = INonfungiblePositionManager.CollectParams({
            tokenId: tokenId,
            recipient: returnTokenToUser ? Storage.owner : address(this),
            amount0Max: type(uint128).max,
            amount1Max: type(uint128).max
        });
        nonfungiblePositionManager.collect(collectparams);

        nonfungiblePositionManager.burn(tokenId);

        //remove id from position manager array
        IPositionManager(address(this)).removePositionId(tokenId);

        //delete the position from the position manager
        emit PositionClosed(address(this), tokenId);

        //return the tokenId and tokens closed
        return (tokenId, uint256(token0Closed), uint256(token1Closed));
    }
}
