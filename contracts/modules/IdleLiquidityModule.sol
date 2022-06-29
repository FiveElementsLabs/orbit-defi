// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import './BaseModule.sol';
import '../helpers/SafeInt24Math.sol';
import '../helpers/UniswapNFTHelper.sol';
import '../helpers/MathHelper.sol';
import '../../interfaces/IPositionManager.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../../interfaces/actions/IClosePosition.sol';
import '../../interfaces/actions/ISwapToPositionRatio.sol';
import '../../interfaces/actions/IMint.sol';

///@title Idle Liquidity Module to manage liquidity for a user position
contract IdleLiquidityModule is BaseModule {
    ///@dev deltaAmountSwapped of the amount because the amount swapped returned by the swapToPositionRatio its not precise
    uint256 constant deltaAmountSwapped = 10;
    ///@notice uniswap address holder
    IUniswapAddressHolder public immutable uniswapAddressHolder;
    using SafeInt24Math for int24;

    ///@notice emitted when a position is rebalanced
    ///@param positionManager address of the called position manager
    ///@param closedPosition tokenId of the closed position
    ///@param mintedPosition tokenId of the minted position
    ///@param amount0 amount of token0 minted
    ///@param amount1 amount of token1 minted
    event positionRebalanced(
        address indexed positionManager,
        uint256 closedPosition,
        uint256 mintedPosition,
        uint256 amount0,
        uint256 amount1
    );

    ///@notice assing the uniswap address holder to the contract
    ///@param _uniswapAddressHolder address of the uniswap address holder
    ///@param _registry address of the registry
    constructor(address _uniswapAddressHolder, address _registry) BaseModule(_registry) {
        require(
            _uniswapAddressHolder != address(0),
            'IdleLiquidityModule::Constructor:uniswapAddressHolder cannot be 0'
        );
        require(_registry != address(0), 'IdleLiquidityModule::Constructor:registry cannot be 0');

        uniswapAddressHolder = IUniswapAddressHolder(_uniswapAddressHolder);
    }

    ///@notice check if the position is out of range and rebalance it by swapping the tokens as necessary
    ///@param tokenId tokenId of the position
    ///@param positionManager address of the position manager
    function rebalance(uint256 tokenId, address positionManager)
        public
        onlyWhitelistedKeeper
        activeModule(positionManager, tokenId)
    {
        uint24 tickDistance = UniswapNFTHelper._checkDistanceFromRange(
            tokenId,
            uniswapAddressHolder.nonfungiblePositionManagerAddress(),
            uniswapAddressHolder.uniswapV3FactoryAddress()
        );
        (, bytes32 rebalanceDistance) = IPositionManager(positionManager).getModuleInfo(tokenId, address(this));
        require(rebalanceDistance != bytes32(0), 'IdleLiquidityModule:: rebalance: Rebalance distance is 0');

        ///@dev can rebalance only if the pool tick is outside the position range, and it is far enough from it
        if (tickDistance >= MathHelper.fromUint256ToUint24(uint256(rebalanceDistance))) {
            _rebalance(positionManager, tokenId);
        }
    }

    function _rebalance(address positionManager, uint256 tokenId) internal {
        (, , address token0, address token1, uint24 fee, , , , , , , ) = INonfungiblePositionManager(
            uniswapAddressHolder.nonfungiblePositionManagerAddress()
        ).positions(tokenId);
        ///@dev calc tickLower and tickUpper with the same delta as the position but with tick of the pool in center
        (int24 tickLower, int24 tickUpper) = _calcTick(
            tokenId,
            uniswapAddressHolder.nonfungiblePositionManagerAddress()
        );

        ///@dev call closePositionAction
        (, uint256 amount0Closed, uint256 amount1Closed) = IClosePosition(positionManager).closePosition(
            tokenId,
            false
        );

        ///@dev call swapToPositionAction to perform the swap
        (uint256 amount0Swapped, uint256 amount1Swapped) = ISwapToPositionRatio(positionManager).swapToPositionRatio(
            ISwapToPositionRatio.SwapToPositionInput(
                token0,
                token1,
                fee,
                amount0Closed,
                amount1Closed,
                tickLower,
                tickUpper
            )
        );

        ///@dev call mintAction
        (uint256 mintedPosition, , ) = IMint(positionManager).mint(
            IMint.MintInput(token0, token1, fee, tickLower, tickUpper, amount0Swapped, amount1Swapped)
        );

        emit positionRebalanced(positionManager, tokenId, mintedPosition, amount0Swapped, amount1Swapped);
    }

    ///@notice calc tickLower and tickUpper with the same delta as the position but with tick of the pool in center
    ///@param tokenId tokenId of the position
    ///@return int24 tickLower
    ///@return int24 tickUpper
    function _calcTick(uint256 tokenId, address nonfungiblePositionManagerAddress)
        internal
        view
        returns (int24, int24)
    {
        (, , , , uint24 fee, int24 tickLower, int24 tickUpper, , , , , ) = INonfungiblePositionManager(
            nonfungiblePositionManagerAddress
        ).positions(tokenId);

        int24 tickDelta = tickUpper.sub(tickLower);

        IUniswapV3Pool pool = IUniswapV3Pool(
            UniswapNFTHelper._getPoolFromTokenId(
                tokenId,
                INonfungiblePositionManager(nonfungiblePositionManagerAddress),
                uniswapAddressHolder.uniswapV3FactoryAddress()
            )
        );

        (, int24 tick, , , , , ) = pool.slot0();
        int24 tickSpacing = MathHelper.fromUint24ToInt24(fee).div(50);

        return (
            tick.sub(tickDelta).div(tickSpacing).mul(tickSpacing),
            tick.add(tickDelta).div(tickSpacing).mul(tickSpacing)
        );
    }
}
