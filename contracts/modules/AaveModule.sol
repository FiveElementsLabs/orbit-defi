// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import '../../interfaces/ILendingPool.sol';
import '../../interfaces/IAaveAddressHolder.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../../interfaces/DataTypes.sol';
import '../../interfaces/IPositionManager.sol';
import '../helpers/UniswapNFTHelper.sol';
import '../actions/AaveDeposit.sol';
import '../actions/DecreaseLiquidity.sol';
import '../actions/CollectFees.sol';

contract AaveModule {
    IAaveAddressHolder public aaveAddressHolder;
    IUniswapAddressHolder uniswapAddressHolder;

    constructor(address _aaveAddressHolder, address _uniswapAddressHolder) {
        aaveAddressHolder = IAaveAddressHolder(_aaveAddressHolder);
        uniswapAddressHolder = IUniswapAddressHolder(_uniswapAddressHolder);
    }

    ///@notice deposit a position in an Aave lending pool
    ///@param positionManager address of the position manager
    ///@param tokenId id of the Uniswap position to deposit
    function depositToAave(address positionManager, uint256 tokenId) external {
        require(
            IPositionManager(positionManager).getModuleState(tokenId, address(this)),
            'AaveModule::depositToAave: Module is inactive.'
        );
        int24 tickDistance = _checkDistanceFromRange(tokenId);
        uint24 tickDelta = abi.decode(
            IPositionManager(positionManager).getModuleData(tokenId, address(this)),
            (uint24)
        );
        ///@dev move token to aave only if the position's range is outside of the tick of the pool
        ///@dev (tickDistance < 0) and the position is far enough from tick of the pool
        if (tickDistance < 0 && tickDelta <= uint24(tickDistance)) {
            (uint256 amount0, uint256 amount1) = UniswapNFTHelper._getAmountsfromTokenId(
                tokenId,
                INonfungiblePositionManager(uniswapAddressHolder.nonfungiblePositionManagerAddress()),
                address(uniswapAddressHolder.uniswapV3FactoryAddress())
            );
            require(amount0 > 0 || amount1 > 0, 'AaveModule::depositToAave: One amount should be 0.');

            (, , address token0, address token1, , , , , , , , ) = INonfungiblePositionManager(
                uniswapAddressHolder.nonfungiblePositionManagerAddress()
            ).positions(tokenId);

            DataTypes.ReserveData memory reserveData;

            IDecreaseLiquidity(positionManager).decreaseLiquidity(tokenId, amount0, amount1);
            (uint256 amount0Collected, uint256 amount1Collected) = ICollectFees(positionManager).collectFees(tokenId);

            if (amount0Collected > 0) {
                reserveData = ILendingPool(aaveAddressHolder.lendingPoolAddress()).getReserveData(token0);
                if (reserveData.aTokenAddress != address(0)) {
                    IAaveDeposit(positionManager).depositToAave(
                        token0,
                        amount0Collected,
                        aaveAddressHolder.lendingPoolAddress()
                    );
                }
            }
            if (amount1Collected > 0) {
                reserveData = ILendingPool(aaveAddressHolder.lendingPoolAddress()).getReserveData(token1);
                if (reserveData.aTokenAddress != address(0)) {
                    IAaveDeposit(positionManager).depositToAave(
                        token1,
                        amount1Collected,
                        aaveAddressHolder.lendingPoolAddress()
                    );
                }
            }
        }
    }

    ///@notice checkDistance from ticklower tickupper from tick of the pools
    ///@param tokenId tokenId of the position
    ///@return int24 distance from ticklower tickupper from tick of the pools and return the minimum distance
    function _checkDistanceFromRange(uint256 tokenId) internal view returns (int24) {
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

        ) = INonfungiblePositionManager(address(uniswapAddressHolder.nonfungiblePositionManagerAddress())).positions(
                tokenId
            );

        IUniswapV3Pool pool = IUniswapV3Pool(
            UniswapNFTHelper._getPool(address(uniswapAddressHolder.uniswapV3FactoryAddress()), token0, token1, fee)
        );
        (, int24 tick, , , , , ) = pool.slot0();

        int24 distanceFromUpper = tickUpper - tick;
        int24 distanceFromLower = tick - tickLower;

        return distanceFromLower <= distanceFromUpper ? distanceFromLower : distanceFromUpper;
    }
}
