// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../interfaces/IPositionManager.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol';

contract IdleLiquidityModule {
    INonfungiblePositionManager public immutable nonFungiblePositionManager;
    address public immutable uniswapV3FactoryAddress;

    constructor(INonfungiblePositionManager _nonfungiblePositionManager, address _uniswapV3Factory) {
        nonFungiblePositionManager = _nonfungiblePositionManager;
        uniswapV3FactoryAddress = _uniswapV3Factory;
    }

    //returns distance from position (in ticks), if output is negative => position is out of range
    function checkDistanceFromRange(uint256 tokenId) public view returns (int24) {
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
        address poolAddress = PoolAddress.computeAddress(
            uniswapV3FactoryAddress,
            PoolAddress.getPoolKey(token0, token1, fee)
        );
        IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
        (, int24 tick, , , , , ) = pool.slot0();

        int24 distanceFromUpper = tickUpper - tick;
        int24 distanceFromLower = tick - tickLower;
        return min24(distanceFromLower, distanceFromUpper);
    }

    function min24(int24 a, int24 b) internal pure returns (int24) {
        return a <= b ? a : b;
    }
}
