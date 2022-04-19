// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../helpers/ERC20Helper.sol';
import '../helpers/NFTHelper.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../utils/Storage.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';

interface IDecreaseLiquidity {
    function decreaseLiquidity(
        uint256 tokenId,
        uint256 amount0Desired,
        uint256 amount1Desired
    )
        external
        returns (
            uint128 liquidityToDecrease,
            uint256 amount0,
            uint256 amount1
        );
}

///@notice action to decrease liquidity of an NFT position
contract DecreaseLiquidity {
    ///@notice decrease the liquidity of a V3 position
    ///@param tokenId the tokenId of the position
    ///@param amount0Desired the amount of token0 liquidity desired
    ///@param amount1Desired the amount of token1 liquidity desired
    ///@return liquidityToDecrease the amount of liquidity to decrease
    ///@return amount0 the amount of token0 removed
    ///@return amount1 the amount of token1 removed
    function decreaseLiquidity(
        uint256 tokenId,
        uint256 amount0Desired,
        uint256 amount1Desired
    )
        public
        returns (
            uint128 liquidityToDecrease,
            uint256 amount0,
            uint256 amount1
        )
    {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        (, , , , , int24 tickLower, int24 tickUpper, uint128 liquidity, , , , ) = INonfungiblePositionManager(
            IUniswapAddressHolder(Storage.uniswapAddressHolder).nonfungiblePositionManagerAddress()
        ).positions(tokenId);

        IUniswapV3Pool pool = IUniswapV3Pool(
            NFTHelper._getPoolFromTokenId(
                tokenId,
                INonfungiblePositionManager(
                    IUniswapAddressHolder(Storage.uniswapAddressHolder).nonfungiblePositionManagerAddress()
                ),
                IUniswapAddressHolder(Storage.uniswapAddressHolder).uniswapV3FactoryAddress()
            )
        );

        (uint160 sqrtRatioX96, , , , , , ) = pool.slot0();

        liquidityToDecrease = LiquidityAmounts.getLiquidityForAmounts(
            sqrtRatioX96,
            TickMath.getSqrtRatioAtTick(tickLower),
            TickMath.getSqrtRatioAtTick(tickUpper),
            amount0Desired,
            amount1Desired
        );

        ///@dev remove all liquidity if the amount to decrease is greater than the amount in the pool
        if (liquidityToDecrease > liquidity) {
            liquidityToDecrease = liquidity;
        }

        INonfungiblePositionManager.DecreaseLiquidityParams memory decreaseliquidityparams = INonfungiblePositionManager
            .DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: liquidityToDecrease,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 120
            });

        (amount0, amount1) = INonfungiblePositionManager(
            IUniswapAddressHolder(Storage.uniswapAddressHolder).nonfungiblePositionManagerAddress()
        ).decreaseLiquidity(decreaseliquidityparams);
    }
}
