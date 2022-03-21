// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../interfaces/IVault.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol';
import '@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol';
import '@uniswap/v3-core/contracts/libraries/FixedPoint96.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import 'hardhat/console.sol';

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

    function getRatioFromRange(
        int24 tickLower,
        int24 tickUpper,
        address token0,
        address token1,
        uint24 fee
    ) public view returns (uint256 ratioE18) {
        uint256 amount0 = 1e18;
        address poolAddress = PoolAddress.computeAddress(
            uniswapV3FactoryAddress,
            PoolAddress.getPoolKey(token0, token1, fee)
        );
        IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);

        (uint160 sqrtPriceX96, , , , , , ) = pool.slot0();

        uint160 sqrtPriceLowerX96 = TickMath.getSqrtRatioAtTick(tickLower);
        uint160 sqrtPriceUpperX96 = TickMath.getSqrtRatioAtTick(tickUpper);

        // @dev Calculates amount0 * (sqrt(upper) * sqrt(lower)) / (sqrt(upper) - sqrt(lower))
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmount0(sqrtPriceX96, sqrtPriceUpperX96, amount0);
        ratioE18 = LiquidityAmounts.getAmount1ForLiquidity(sqrtPriceX96, sqrtPriceLowerX96, liquidity);
    }

    function swap(
        uint256 amount0Input,
        uint256 amount1Input,
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper
    ) public view returns (int256 toSwap) {
        uint256 ratioE18 = getRatioFromRange(tickLower, tickUpper, token0, token1, fee);
        console.log(ratioE18);
        //uint256 ratio = ratioE18 / 1e18;

        address poolAddress = PoolAddress.computeAddress(
            uniswapV3FactoryAddress,
            PoolAddress.getPoolKey(token0, token1, fee)
        );
        IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);

        (uint160 sqrtPriceX96, , , , , , ) = pool.slot0();

        //uint256 valueX96 = (amount0Input * ((sqrtPriceX96**2) >> 96)) + (amount1Input << 96);
        //uint256 value = (amount0Input * (sqrtPriceX96 / 2**96)**2) + (amount1Input);
        uint256 value = (amount0Input * (sqrtPriceX96 / 2**96)**2) + (amount1Input);

        console.log('price');
        console.log((sqrtPriceX96**2) >> 192);
        console.log((sqrtPriceX96**2) >> 96);
        console.log((sqrtPriceX96 >> 48)**2);
        console.log('value');

        console.log(amount0Input * ((sqrtPriceX96**2) >> 96));
        /*  console.log(value);
        console.log(valueX96 >> 96);
        uint256 y = ((ratioE18 * valueX96) / (ratioE18 + 1e18)) >> 96;
        //console.log(ratio);
        //uint256 y = ((ratioE18 * valueX96) / (ratioE18 + 1e18));
        toSwap = int256(amount1Input - y);
        console.log('y');
        console.log(amount1Input);
        console.log(y); */

        /*
        ratio = ratio / 1e6;
      console.log(ratio);

      const x0 = BigNumber.from('0x' + (2000).toString(16));
      const y0 = BigNumber.from('0x' + (1000).toString(16));

      const sqrtPriceX96: BigNumber = await Pool0.slot0().then((r) => r.sqrtPriceX96);
      const pow = BigNumber.from('0x2').pow(96);
      const value: BigNumber = x0.mul(Math.pow(sqrtPriceX96.div(pow).toNumber(), 2)).add(y0);
      console.log('value');
      console.log(value);

      const y = (ratio / (ratio + 1)) * value.toNumber();
      console.log('y');
      console.log(y);

      const toSwapY = y0.toNumber() - y;
        */
    }

    function min24(int24 a, int24 b) internal pure returns (int24) {
        return a <= b ? a : b;
    }
}
