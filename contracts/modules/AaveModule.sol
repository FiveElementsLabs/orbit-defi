// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import '../../interfaces/ILendingPool.sol';
import '../../interfaces/IAaveAddressHolder.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../../interfaces/DataTypes.sol';
import '../helpers/UniswapNFTHelper.sol';
import '../actions/AaveDeposit.sol';

import 'hardhat/console.sol';

contract AaveModule {
    ILendingPool public LendingPool;
    IUniswapAddressHolder uniswapAddressHolder;

    constructor(address _lendingPool, address _uniswapAddressHolder) public {
        LendingPool = ILendingPool(_lendingPool);
        uniswapAddressHolder = IUniswapAddressHolder(_uniswapAddressHolder);
    }

    function depositToAave(
        address positionManager,
        uint256 tokenId,
        uint24 tickDelta
    ) public {
        int24 tickDistance = _checkDistanceFromRange(tokenId);
        ///@dev move token to aave only if the position's range is outside of the tick of the pool (tickDistance < 0) and the position is far enough from tick of the pool
        revert('TODO');
        require(false, 'false');
        // find if token0 or token1 balance
        // search if aave have the token
        // deposit that token
        // if position is inside range of the tick of the pool, then withdraw from aave (if possible)
        // lower i have token0, upper i have token1
        //if (tickDistance < 0 && tickDelta <= uint24(tickDistance)) {
        (uint256 amount0, uint256 amount1) = UniswapNFTHelper._getAmountsfromTokenId(
            tokenId,
            INonfungiblePositionManager(uniswapAddressHolder.nonfungiblePositionManagerAddress()),
            address(uniswapAddressHolder.uniswapV3FactoryAddress())
        );
        //require(amount0 > 0 || amount1 > 0, 'AaveModule::depositToAave: One amount should be 0.');

        (, , address token0, address token1, , , , , , , , ) = INonfungiblePositionManager(
            uniswapAddressHolder.nonfungiblePositionManagerAddress()
        ).positions(tokenId);

        DataTypes.ReserveData memory reserveData = LendingPool.getReserveData(token0);
        console.log(reserveData.aTokenAddress);
        require(reserveData.aTokenAddress == address(0), 'AaveModule::depositToAave: Token is not supported.');

        if (amount0 > 0) {
            IAaveDeposit(positionManager).depositToAave(token0, amount0, address(LendingPool));
        }
        if (amount1 > 0) {
            IAaveDeposit(positionManager).depositToAave(token1, amount1, address(LendingPool));
        }

        //IAaveDeposit(address(positionManager)).depositToAave(token0, amount, LendingPool.address);
        //}
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
