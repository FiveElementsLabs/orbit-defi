// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '../../interfaces/ILendingPool.sol';
import '../../interfaces/IAaveAddressHolder.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../../interfaces/DataTypes.sol';
import '../../interfaces/IPositionManager.sol';
import '../helpers/UniswapNFTHelper.sol';
import '../actions/AaveDeposit.sol';
import '../actions/AaveWithdraw.sol';
import '../actions/ClosePosition.sol';
import '../actions/Swap.sol';
import '../actions/SwapToPositionRatio.sol';
import '../actions/Mint.sol';

contract AaveModule {
    IAaveAddressHolder public aaveAddressHolder;
    IUniswapAddressHolder uniswapAddressHolder;

    modifier activeModule(address positionManager, uint256 tokenId) {
        require(
            IPositionManager(positionManager).getModuleState(tokenId, address(this)),
            'AaveModule::activeModule: Module is inactive.'
        );
        _;
    }

    constructor(address _aaveAddressHolder, address _uniswapAddressHolder) {
        aaveAddressHolder = IAaveAddressHolder(_aaveAddressHolder);
        uniswapAddressHolder = IUniswapAddressHolder(_uniswapAddressHolder);
    }

    ///@notice deposit a position in an Aave lending pool
    ///@param positionManager address of the position manager
    ///@param tokenId id of the Uniswap position to deposit
    function depositIfNeeded(address positionManager, uint256 tokenId) public activeModule(positionManager, tokenId) {
        address toAaveToken = abi.decode(
            IPositionManager(positionManager).getModuleData(tokenId, address(this)),
            (address)
        );
        ///@dev move token to aave only if the position's range is outside of the tick of the pool
        if (_checkDistanceFromRange(tokenId) > 0) {
            _depositToAave(positionManager, tokenId, toAaveToken);
        }
    }

    ///@notice check if withdraw is needed and execute
    ///@param positionManager address of the position manager
    ///@param token address of the token of Aave position
    ///@param id id of the Aave position to withdraw
    function withdrawIfNeeded(
        address positionManager,
        address token,
        uint256 id
    ) public {
        INonfungiblePositionManager.MintParams memory oldPosition = IPositionManager(positionManager)
            .getOldPositionData(token, id);
        (, int24 tickPool, , , , , ) = IUniswapV3Pool(
            UniswapNFTHelper._getPool(
                address(uniswapAddressHolder.uniswapV3FactoryAddress()),
                oldPosition.token0,
                oldPosition.token1,
                oldPosition.fee
            )
        ).slot0();
        if (tickPool > oldPosition.tickLower && tickPool < oldPosition.tickUpper) {
            _returnToUniswap(positionManager, token, id, oldPosition);
        }
    }

    ///@notice deposit a uni v3 position to an Aave lending pool
    ///@param positionManager address of the position manager
    ///@param tokenId id of the Uniswap position to deposit
    ///@param toAaveToken address of the token to deposit to Aave
    function _depositToAave(
        address positionManager,
        uint256 tokenId,
        address toAaveToken
    ) internal {
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

        (, uint256 amount0Collected, uint256 amount1Collected) = IClosePosition(positionManager).closePosition(
            tokenId,
            false
        );

        uint256 amountToAave = 0;
        if (amount0Collected > 0) {
            if (token0 == toAaveToken) {
                amountToAave += amount0Collected;
            } else {
                amountToAave += ISwap(positionManager).swap(
                    token0,
                    toAaveToken,
                    _findBestFee(token0, toAaveToken),
                    amount0Collected
                );
            }
        }

        if (amount1Collected > 0) {
            if (token1 == toAaveToken) {
                amountToAave += amount1Collected;
            } else {
                amountToAave += ISwap(positionManager).swap(
                    token1,
                    toAaveToken,
                    _findBestFee(token1, toAaveToken),
                    amount1Collected
                );
            }
        }

        require(
            ILendingPool(aaveAddressHolder.lendingPoolAddress()).getReserveData(token0).aTokenAddress != address(0),
            'AaveModule::_depositToAave: Aave token not found.'
        );

        (uint256 id, ) = IAaveDeposit(positionManager).depositToAave(toAaveToken, amountToAave);

        IPositionManager(positionManager).pushOldPositionData(
            toAaveToken,
            id,
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: fee,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: 0,
                amount1Desired: 0,
                amount0Min: 0,
                amount1Min: 0,
                recipient: 0x0000000000000000000000000000000000000000,
                deadline: 0
            })
        );
    }

    ///@notice return a position to Uniswap
    ///@param positionManager address of the position manager
    ///@param token address of the token of Aave position
    ///@param id id of the Aave position to withdraw
    function _returnToUniswap(
        address positionManager,
        address token,
        uint256 id,
        INonfungiblePositionManager.MintParams memory mintParams
    ) internal {
        uint256 amountWithdrawn = IAaveWithdraw(positionManager).withdrawFromAave(token, id);

        uint256 amount0In = ISwap(positionManager).swap(token, mintParams.token0, mintParams.fee, amountWithdrawn);

        (uint256 amount0Out, uint256 amount1Out) = ISwapToPositionRatio(positionManager).swapToPositionRatio(
            ISwapToPositionRatio.SwapToPositionInput({
                token0Address: mintParams.token0,
                token1Address: mintParams.token1,
                fee: mintParams.fee,
                amount0In: amount0In,
                amount1In: 0,
                tickLower: mintParams.tickLower,
                tickUpper: mintParams.tickUpper
            })
        );

        IMint(positionManager).mint(
            IMint.MintInput({
                token0Address: mintParams.token0,
                token1Address: mintParams.token1,
                fee: mintParams.fee,
                tickLower: mintParams.tickLower,
                tickUpper: mintParams.tickUpper,
                amount0Desired: amount0Out,
                amount1Desired: amount1Out
            })
        );
    }

    ///@notice checkDistance from ticklower tickupper from tick of the pools
    ///@param tokenId tokenId of the position
    ///@return int24 distance from ticklower tickupper from tick of the pools and return the minimum distance
    function _checkDistanceFromRange(uint256 tokenId) internal view returns (uint24) {
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

        if (tick > tickUpper) {
            return uint24(tick - tickUpper);
        } else if (tick < tickLower) {
            return uint24(tickLower - tick);
        } else {
            return 0;
        }
    }

    ///@notice finds the best fee tier on which to perform a swap
    ///@param token0 address of first token
    ///@param token1 address of second token
    ///@return fee suggested fee tier
    function _findBestFee(address token0, address token1) internal view returns (uint24 fee) {
        uint128 bestLiquidity = 0;
        uint16[4] memory fees = [100, 500, 3000, 10000];

        for (uint8 i = 0; i < 4; i++) {
            try this.getPoolLiquidity(token0, token1, uint24(fees[i])) returns (uint128 nextLiquidity) {
                if (nextLiquidity > bestLiquidity) {
                    bestLiquidity = nextLiquidity;
                    fee = fees[i];
                }
            } catch {
                //pass
            }
        }

        if (bestLiquidity == 0) {
            revert('AaveModule::_findBestFee: No pool found with desired tokens');
        }
    }

    ///@notice wrapper of getPoolLiquidity to use try/catch statement
    ///@param token0 address of first token
    ///@param token1 address of second token
    ///@param fee pool fee tier
    ///@return liquidity of the pool
    function getPoolLiquidity(
        address token0,
        address token1,
        uint24 fee
    ) public view returns (uint128 liquidity) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        return
            IUniswapV3Pool(
                UniswapNFTHelper._getPool(Storage.uniswapAddressHolder.uniswapV3FactoryAddress(), token0, token1, fee)
            ).liquidity();
    }
}
