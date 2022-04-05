// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '../../interfaces/IPositionManager.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../helpers/NFTHelper.sol';
import '../helpers/ERC20Helper.sol';

///@title Idle Liquidity Module to manage liquidity for a user position
contract IdleLiquidityModule {
    ///@notice uniswap address holder
    IUniswapAddressHolder public uniswapAddressHolder;

    address public actionAddressClose = 0x3Aa5ebB10DC797CAC828524e59A333d0A371443c;
    address public actionAddressMint = 0xc6e7DF5E7b4f2A278906862b61205850344D4e7d;
    address public actionAddressSwapToPosition = 0x59b670e9fA9D0A427751Af201D676719a970857b;

    ///@notice assing the uniswap address holder to the contract
    ///@param _uniswapAddressHolder address of the uniswap address holder
    constructor(address _uniswapAddressHolder) {
        uniswapAddressHolder = IUniswapAddressHolder(_uniswapAddressHolder);
    }

    ///@notice checkDistance from ticklower tickupper from tick of the pools
    ///@param tokenid tokenId of the position
    ///@param positionManager address of the position manager
    ///@return int24 distance from ticklower tickupper from tick of the pools and return the minimum distance
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

    ///@notice check if the position is in the range of the pools and return rebalance the position swapping the tokens
    ///@param tokenid tokenId of the position
    ///@param positionManager address of the position manager
    function rebalance(uint256 tokenId, IPositionManager positionManager) public {
        int24 tickDiff = checkDistanceFromRange(tokenId, positionManager);

        // using this for all the actions cause declare more will cause stack too deep error
        bytes memory inputs;
        bytes memory outputs;

        ///@dev rebalance only if the position's range is outside of the tick of the pool (tickDiff < 0)
        if (tickDiff < 0) {
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
            inputs = abi.encode(tokenId, false);
            outputs = positionManager.doAction(actionAddressClose, inputs);
            (uint256 tokenId, uint256 amount0Closed, uint256 amount1Closed) = abi.decode(
                outputs,
                (uint256, uint256, uint256)
            );

            ///@dev call swapToPositionAction to perform the swap
            inputs = abi.encode(token0, token1, fee, amount0Closed, amount1Closed, tickLower, tickUpper);
            outputs = positionManager.doAction(actionAddressSwapToPosition, inputs);
            (uint256 token0Swapped, uint256 token1Swapped) = abi.decode(outputs, (uint256, uint256));

            ///@dev call mintAction
            inputs = abi.encode(token0, token1, fee, tickLower, tickUpper, token0Swapped, token1Swapped);
            positionManager.doAction(actionAddressMint, inputs);
        }
    }

    ///@notice calc tickLower and tickUpper with the same delta as the position but with tick of the pool in center
    ///@param tokenid tokenId of the position
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
