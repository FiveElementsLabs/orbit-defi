// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../interfaces/IVault.sol';
import '@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
<<<<<<< Updated upstream
import '@openzeppelin/contracts/math/Math.sol';
=======
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol';
>>>>>>> Stashed changes

contract IdleLiquidityModule {
    INonfungiblePositionManager public immutable nonFungiblePositionManager;
    address public immutable uniswapV3FactoryAddress;

    constructor(INonfungiblePositionManager _nonfungiblePositionManager, address _uniswapV3Factory) {
        nonFungiblePositionManager = _nonfungiblePositionManager;
        uniswapV3FactoryAddress = _uniswapV3Factory;
    }

    //returns distance from position (in ticks), if output is negative => position is out of range
    function checkDistanceFromRange(uint256 tokenId) public view returns (int24 distanceFromRange) {
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
        distanceFromRange = min(distanceFromLower, distanceFromUpper);
    }

<<<<<<< Updated upstream
=======
    function swapLogic(
        uint256 amount0,
        uint256 amount1,
        int24 tickPool,
        int24 tickLower,
        int24 tickUpper
    ) public {}

>>>>>>> Stashed changes
    function min(int24 a, int24 b) internal pure returns (int24) {
        return a <= b ? a : b;
    }
}
