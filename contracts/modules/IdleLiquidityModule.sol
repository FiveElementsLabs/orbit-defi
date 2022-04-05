// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '../../interfaces/IPositionManager.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../helpers/NFTHelper.sol';
import '../helpers/ERC20Helper.sol';

contract IdleLiquidityModule {
    ///@notice uniswap address holder
    IUniswapAddressHolder public uniswapAddressHolder;
    address public actionAddressClose = 0x3Aa5ebB10DC797CAC828524e59A333d0A371443c;
    address public actionAddressMint = 0xc6e7DF5E7b4f2A278906862b61205850344D4e7d;
    address public actionAddressSwapToPosition = 0x59b670e9fA9D0A427751Af201D676719a970857b;

    ///@notice assing the uniswap address holder to the contract
    constructor(address _uniswapAddressHolder) {
        uniswapAddressHolder = IUniswapAddressHolder(_uniswapAddressHolder);
    }

    ///@notice checkDistance from ticklower tickupper from tick of the pools
    function checkDistanceFromRange(uint256 tokenId, IPositionManager positionManager) public view returns (int24) {
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

    function rebalance(uint256 tokenId, IPositionManager positionManager) public {
        //checkDistanceFromRange
        //if position is out of range -> close position -> mint new position with new range  (using the delta of the old one)
        //if position is in range -> do nothing

        int24 tickDiff = checkDistanceFromRange(tokenId, positionManager);

        bytes memory inputs;
        bytes memory outputs;

        if (tickDiff < 0) {
            //close position
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

            (int24 tickLower, int24 tickUpper) = _calcTick(tokenId, fee);

            inputs = abi.encode(tokenId, false);
            outputs = positionManager.doAction(actionAddressClose, inputs);
            (uint256 tokenId, uint256 amount0Closed, uint256 amount1Closed) = abi.decode(
                outputs,
                (uint256, uint256, uint256)
            );

            //get position data from position manager by tokenId
            //mint new position with the old token and fee

            inputs = abi.encode(token0, token1, fee, amount0Closed, amount1Closed, tickLower, tickUpper);
            outputs = positionManager.doAction(actionAddressSwapToPosition, inputs);
            (uint256 token0Swapped, uint256 token1Swapped) = abi.decode(outputs, (uint256, uint256));

            inputs = abi.encode(token0, token1, fee, tickLower, tickUpper, token0Swapped, token1Swapped);

            positionManager.doAction(actionAddressMint, inputs);
        }
    }

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

        //get tick from pool.slot0
        (, int24 tick, , , , , ) = pool.slot0();
        int24 tickSpacing = int24(fee) / 50;

        return (((tick - tickDelta) / tickSpacing) * tickSpacing, ((tick + tickDelta) / tickSpacing) * tickSpacing);
    }
}

/*  //returns distance from position (in ticks), if output is negative => position is out of range
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
    } */
