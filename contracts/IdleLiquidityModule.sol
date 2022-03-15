// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../interfaces/IVault.sol';
import '@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@openzeppelin/contracts/math/Math.sol';

contract IdleLiquidityModule {
    INonfungiblePositionManager public immutable nonFungiblePositionManager;

    constructor(INonfungiblePositionManager nonfungiblePositionManager) {
        nonFungiblePositionManager = nonfungiblePositionManager;
    }

    //returns distance from position (in ticks), if output is negative => position is out of range
    function checkDistanceFromRange(uint256 tokenId, address poolAddress)
        public
        view
        returns (int24 distanceFromRange)
    {
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

        ) = nonFungiblePositionManager.positions(tokenId);
        IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
        (, int24 tick, , , , , ) = pool.slot0();
        int24 distanceFromUpper = tickUpper - tick;
        int24 distanceFromLower = tick - tickLower;
        distanceFromRange = min(distanceFromLower, distanceFromUpper);
    }

    function min(int24 a, int24 b) internal pure returns (int24) {
        return a <= b ? a : b;
    }
}
