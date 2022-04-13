// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '../../interfaces/IPositionManager.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../actions/ClosePosition.sol';
import '../actions/SwapToPositionRatio.sol';
import '../actions/Mint.sol';
import '../helpers/NFTHelper.sol';
import '../helpers/ERC20Helper.sol';

///@title Idle Liquidity Module to manage liquidity for a user position
contract IdleLiquidityModule {
    ///@notice uniswap address holder
    IUniswapAddressHolder public uniswapAddressHolder;

    ///@notice assing the uniswap address holder to the contract
    ///@param _uniswapAddressHolder address of the uniswap address holder
    constructor(address _uniswapAddressHolder) {
        uniswapAddressHolder = IUniswapAddressHolder(_uniswapAddressHolder);
    }

    ///@notice checkDistance from ticklower tickupper from tick of the pools
    ///@param tokenId tokenId of the position
    ///@param positionManager address of the position manager
    ///@return int24 distance from ticklower tickupper from tick of the pools and return the minimum distance
    function _checkDistanceFromRange(uint256 tokenId, IPositionManager positionManager) internal view returns (int24) {
        (
            ,
            ,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            ,
            ,
            ,
            ,

        ) = INonfungiblePositionManager(uniswapAddressHolder.nonfungiblePositionManagerAddress()).positions(tokenId);

        IUniswapV3Pool pool = IUniswapV3Pool(
            NFTHelper._getPoolAddress(uniswapAddressHolder.uniswapV3FactoryAddress(), token0, token1, fee)
        );
        (, int24 tick, , , , , ) = pool.slot0();

        int24 distanceFromUpper = tickUpper - tick;
        int24 distanceFromLower = tick - tickLower;

        return distanceFromLower <= distanceFromUpper ? distanceFromLower : distanceFromUpper;
    }

    ///@notice check if the position is in the range of the pools and return rebalance the position swapping the tokens
    ///@param tokenId tokenId of the position
    ///@param positionManager address of the position manager
    function rebalance(
        uint256 tokenId,
        IPositionManager positionManager,
        uint24 tickDistance
    ) public {
        int24 tickDiff = _checkDistanceFromRange(tokenId, positionManager);
        if (positionManager.getModuleState(tokenId, address(this))) {
            int24 tickDiff = _checkDistanceFromRange(tokenId, positionManager);

            ///@dev rebalance only if the position's range is outside of the tick of the pool (tickDiff < 0) and the position is far enough from tick of the pool
            if (tickDiff < 0 && tickDistance <= uint24(tickDiff)) {
                (
                    ,
                    ,
                    address token0,
                    address token1,
                    uint24 fee,
                    ,
                    ,
                    uint128 liquidity,
                    ,
                    ,
                    ,

                ) = INonfungiblePositionManager(uniswapAddressHolder.nonfungiblePositionManagerAddress()).positions(
                        tokenId
                    );

                ///@dev calc tickLower and tickUpper with the same delta as the position but with tick of the pool in center
                (int24 tickLower, int24 tickUpper) = _calcTick(tokenId, fee);

                ///@dev call closePositionAction
                (uint256 tokenId, uint256 amount0Closed, uint256 amount1Closed) = IClosePosition(
                    address(positionManager)
                ).closePosition(tokenId, false);

                ///@dev call swapToPositionAction to perform the swap
                (uint256 token0Swapped, uint256 token1Swapped) = ISwapToPositionRatio(address(positionManager))
                    .swapToPositionRatio(
                        ISwapToPositionRatio.SwapToPositionInput(
                            token0,
                            token1,
                            fee,
                            amount0Closed,
                            amount1Closed,
                            tickLower,
                            tickUpper
                        )
                    );

                ///@dev call mintAction
                IMint(address(positionManager)).mint(
                    IMint.MintInput(token0, token1, fee, tickLower, tickUpper, token0Swapped - 10, token1Swapped - 10)
                );
            }
        }
    }

    ///@notice calc tickLower and tickUpper with the same delta as the position but with tick of the pool in center
    ///@param tokenId tokenId of the position
    ///@param fee fee of the position
    ///@return int24 tickLower
    ///@return int24 tickUpper
    function _calcTick(uint256 tokenId, uint24 fee) internal view returns (int24, int24) {
        (, , , , , int24 tickLower, int24 tickUpper, , , , , ) = INonfungiblePositionManager(
            uniswapAddressHolder.nonfungiblePositionManagerAddress()
        ).positions(tokenId);

        int24 tickDelta = tickUpper - tickLower;

        IUniswapV3Pool pool = IUniswapV3Pool(
            NFTHelper._getPoolFromTokenId(
                tokenId,
                INonfungiblePositionManager(uniswapAddressHolder.nonfungiblePositionManagerAddress()),
                uniswapAddressHolder.uniswapV3FactoryAddress()
            )
        );

        (, int24 tick, , , , , ) = pool.slot0();
        int24 tickSpacing = int24(fee) / 50;

        return (((tick - tickDelta) / tickSpacing) * tickSpacing, ((tick + tickDelta) / tickSpacing) * tickSpacing);
    }
}
