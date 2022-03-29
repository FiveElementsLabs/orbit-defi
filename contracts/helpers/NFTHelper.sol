// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';

///@title library to interact with NFT token and do some usefull function with it
library NFTHelper {
    /*
 address poolAddress = PoolAddress.computeAddress(
            uniswapV3FactoryAddress,
            PoolAddress.getPoolKey(token0, token1, fee)
        );
        */
    /*(, int24 tick, , , , , ) = pool.slot0();
        (uint160 sqrtRatioX96, , , , , , ) = pool.slot0();*/
    /*function min24(int24 a, int24 b) internal pure returns (int24) {
        return a <= b ? a : b;
    }*/
    /*LiquidityAmounts.getAmountsForLiquidity(
                sqrtRatioX96,
                TickMath.getSqrtRatioAtTick(tickLower),
                TickMath.getSqrtRatioAtTick(tickUpper),
                liquidity
            );*/
    /* function getPoolFromTokenId(uint256 tokenId) public view returns (IUniswapV3Pool) {
        (, , address token0, address token1, uint24 fee, , , , , , , ) = nonfungiblePositionManager.positions(tokenId);

        PoolAddress.PoolKey memory key = PoolAddress.getPoolKey(token0, token1, fee);

        address poolAddress = PoolAddress.computeAddress(address(factory), key);

        return IUniswapV3Pool(poolAddress);
    }*/
    /*
    function _getTokenAddress(uint256 tokenId) private view returns (IERC20 token0, IERC20 token1) {
        (, , address token0address, address token1address, , , , , , , , ) = nonfungiblePositionManager.positions(
            tokenId
        );
        token0 = IERC20(token0address);
        token1 = IERC20(token1address);
    }*/
    /*
    getLiquidityForAmount
    min24 from int24 a int24 b
  
    */

    ///@dev address from nonfungiblepositionmanager deployed by Uniswap
    INonFungiblePositionManager public nonfungiblepositionmanager =
        INonFungiblePositionManager('0x0000000000000000000000000000000000000000');

    ///@notice get the pool address
    ///@param factory address of the UniswapV3Factory
    ///@param token0 address of the token0
    ///@param token1 address of the token1
    ///@param fee fee tier of the pool
    ///@return address address of the pool
    function _getPoolAddress(
        address factory,
        address token0,
        address token1,
        uint24 fee
    ) internal view returns (address) {
        return PoolAddress.computeAddress(factory, PoolAddress.getPoolKey(token0, token1, fee));
    }

    ///@notice get the address of the pool from the tokenId
    ///@param tokenId id of the position (NFT)
    ///@param nonfungiblePositionManager instance of the nonfungiblePositionManager given by the caller (address)
    ///@param factory address of the UniswapV3Factory
    ///@return address address of the pool
    function _getPoolFromTokenId(
        uint256 tokenId,
        INonfungiblePositionManager nonfungiblePositionManager,
        address factory
    ) internal view returns (address) {
        (, , address token0, address token1, uint24 fee, , , , , , , ) = nonfungiblePositionManager.positions(tokenId);

        return _getPoolAddress(factory, token0, token1, fee);
    }

    ///@notice get the address of the tpkens from the tokenId
    ///@param tokenId id of the position (NFT)
    ///@param nonfungiblePositionManager instance of the nonfungiblePositionManager given by the caller (address)
    ///@return token0address address of the token0
    ///@return token1address address of the token1
    function _getTokenAddress(uint256 tokenId, INonfungiblePositionManager nonfungiblePositionManager)
        internal
        view
        returns (address token0address, address token1address)
    {
        (, , token0address, token1address, , , , , , , , ) = nonfungiblePositionManager.positions(tokenId);
    }

    ///@notice get the amount of tokens from liquidity and tick ranges
    ///@param liquidity amount of liquidity to convert
    ///@param tickLower lower tick range
    ///@param tickUpper upper tick range
    ///@param poolAddress address of the pool
    ///@return uint256 amount of token0
    ///@return uint256 amount of token1
    function _getAmountFromLiquidity(
        uint128 liquidity,
        int24 tickLower,
        int24 tickUpper,
        address poolAddress
    ) internal view returns (uint256, uint256) {
        IUniswapV3Pool pool = IUniswayV3Pool(poolAddress);

        (uint160 sqrtRatioX96, , , , , , ) = pool.slot0();
        return
            LiquidityAmounts.getAmountsForLiquidity(
                sqrtRatioX96,
                TickMath.getSqrtRatioAtTick(tickLower),
                TickMath.getSqrtRatioAtTick(tickUpper),
                liquidity
            );
    }

    function _getLiquidityFromAmount(uint256 token0, uint256 token1) internal view returns (uint128) {}
}
