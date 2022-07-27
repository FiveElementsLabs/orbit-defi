// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import './BaseModule.sol';
import '../helpers/SafeInt24Math.sol';
import '../helpers/UniswapNFTHelper.sol';
import '../helpers/MathHelper.sol';
import '../../interfaces/IAaveAddressHolder.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../../interfaces/actions/IAaveDeposit.sol';
import '../../interfaces/actions/IAaveWithdraw.sol';
import '../../interfaces/actions/IDecreaseLiquidity.sol';
import '../../interfaces/actions/ICollectFees.sol';
import '../../interfaces/actions/ISwap.sol';
import '../../interfaces/actions/ISwapToPositionRatio.sol';
import '../../interfaces/actions/IIncreaseLiquidity.sol';
import '../../interfaces/ILendingPool.sol';

contract AaveModule is BaseModule {
    IAaveAddressHolder public immutable aaveAddressHolder;
    IUniswapAddressHolder public immutable uniswapAddressHolder;
    using SafeInt24Math for int24;

    ///@dev struct for storing _getToken return datas and avoiding stack too deep error and repetitive call
    ///@param token0 address of the first token
    ///@param token1 address of the second token
    ///@param fee fee tier of the pool
    ///@param tickLower lower bound of the position
    ///@param tickUpper upper bound of the position
    struct TokenData {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
    }

    ///@notice emitted when a uniswap position liquidity is moved to aave
    ///@param positionManager address of positionManager which deposited
    ///@param tokenId id of the uniswap NFT from which liquidity is being withdrawn
    ///@param tokenDeposited address of the token deposited to aave
    ///@param amountDeposited amount of tokenDeposited deposited to aave
    ///@param aaveId id of the opened aave position
    event MovedToAave(
        address indexed positionManager,
        uint256 tokenId,
        address tokenDeposited,
        uint256 amountDeposited,
        uint256 aaveId
    );

    ///@notice emitted when a aave position liquidity is moved to uniswap
    ///@param positionManager address of positionManager which withdrawed
    ///@param tokenId id of the uniswap NFT to which liquidity is being deposited
    ///@param tokenWithdrawn address of the token withdrawn from aave
    ///@param amountWithdrawn amount of tokenWithdrawn withdrawn from aave
    ///@param aaveId id of the closed aave position
    event MovedToUniswap(
        address indexed positionManager,
        uint256 tokenId,
        address tokenWithdrawn,
        uint256 amountWithdrawn,
        uint256 aaveId
    );

    constructor(
        address _aaveAddressHolder,
        address _uniswapAddressHolder,
        address _registry
    ) BaseModule(_registry) {
        aaveAddressHolder = IAaveAddressHolder(_aaveAddressHolder);
        uniswapAddressHolder = IUniswapAddressHolder(_uniswapAddressHolder);
    }

    ///@notice deposit a uniswap position liquidity in an Aave lending pool
    ///@param positionManager address of the position manager
    ///@param tokenId id of the Uniswap position to deposit
    function moveToAave(address positionManager, uint256 tokenId)
        external
        activeModule(positionManager, tokenId)
        onlyWhitelistedKeeper
    {
        (, bytes32 data) = IPositionManager(positionManager).getModuleInfo(tokenId, address(this));

        require(data != bytes32(0), 'AaveModule::moveToAave: module data cannot be empty');

        uint24 distanceFromRange = UniswapNFTHelper._checkDistanceFromRange(
            tokenId,
            uniswapAddressHolder.nonfungiblePositionManagerAddress(),
            uniswapAddressHolder.uniswapV3FactoryAddress()
        );

        ///@dev move token to aave only if the position's range is outside of the tick of the pool
        if (distanceFromRange != 0 && MathHelper.fromUint256ToUint24(uint256(data)) <= distanceFromRange) {
            _moveToAave(positionManager, tokenId);
        } else revert('AaveModule::moveToAave: move to aave is not needed');
    }

    ///@notice move liquidity deposited on aave back to its uniswap position
    ///@param positionManager address of the position manager
    ///@param tokenId id of the uniswap nft to withdraw from aaave
    function moveToUniswap(address positionManager, uint256 tokenId) external onlyWhitelistedKeeper {
        (, address tokenFromAave) = IPositionManager(positionManager).getAaveDataFromTokenId(tokenId);

        require(tokenFromAave != address(0), 'AaveModule::moveToUniswap: token cannot be address 0');

        INonfungiblePositionManager NonfungiblePositionManager = INonfungiblePositionManager(
            uniswapAddressHolder.nonfungiblePositionManagerAddress()
        );

        (, int24 tickPool, , , , , ) = IUniswapV3Pool(
            UniswapNFTHelper._getPoolFromTokenId(
                tokenId,
                NonfungiblePositionManager,
                uniswapAddressHolder.uniswapV3FactoryAddress()
            )
        ).slot0();

        (address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper) = UniswapNFTHelper._getTokens(
            tokenId,
            NonfungiblePositionManager
        );

        (bool isActive, bytes32 data) = IPositionManager(positionManager).getModuleInfo(tokenId, address(this));

        // only withdraw if the tick is 10% of the move to aave distance away from being back in range
        int24 minimumTickVariation = int24(MathHelper.fromUint256ToUint24(uint256(data))).mul(10).div(100);

        if (
            (tickPool > tickLower.sub(minimumTickVariation) && tickPool < tickUpper.add(minimumTickVariation)) ||
            !isActive
        ) {
            _moveToUniswap(
                positionManager,
                tokenFromAave,
                tokenId,
                TokenData(token0, token1, fee, tickLower, tickUpper)
            );
        } else revert('AaveModule::moveToUniswap: not needed.');
    }

    ///@notice deposit a uni v3 position's liquidity to an Aave lending pool
    ///@param positionManager address of the position manager
    ///@param tokenId id of the Uniswap position to deposit
    function _moveToAave(address positionManager, uint256 tokenId) internal {
        INonfungiblePositionManager NonFungiblePositionManager = INonfungiblePositionManager(
            uniswapAddressHolder.nonfungiblePositionManagerAddress()
        );

        (, , address token0, address token1, , , , , , , , ) = NonFungiblePositionManager.positions(tokenId);
        address toAaveToken = _calcToAaveToken(NonFungiblePositionManager, tokenId, token0, token1);

        (uint256 amount0ToDecrease, uint256 amount1ToDecrease) = UniswapNFTHelper._getAmountsfromTokenId(
            tokenId,
            NonFungiblePositionManager,
            uniswapAddressHolder.uniswapV3FactoryAddress()
        );

        IDecreaseLiquidity(positionManager).decreaseLiquidity(tokenId, amount0ToDecrease, amount1ToDecrease);
        (uint256 amount0Collected, uint256 amount1Collected) = ICollectFees(positionManager).collectFees(
            tokenId,
            false
        );

        if (toAaveToken == token0) {
            if (amount1Collected != 0) {
                amount0Collected += ISwap(positionManager).swap(
                    token1,
                    toAaveToken,
                    _findBestFee(token1, toAaveToken),
                    amount1Collected,
                    false
                );
            }
        } else if (amount0Collected != 0) {
            amount1Collected += ISwap(positionManager).swap(
                token0,
                toAaveToken,
                _findBestFee(token0, toAaveToken),
                amount0Collected,
                false
            );
        }

        IAaveDeposit(positionManager).depositToAave(
            toAaveToken,
            toAaveToken == token0 ? amount0Collected : amount1Collected,
            tokenId
        );

        emit MovedToAave(
            positionManager,
            tokenId,
            toAaveToken,
            toAaveToken == token0 ? amount0Collected : amount1Collected,
            tokenId
        );
    }

    ///@notice return an aave position's liquidity to Uniswap nft
    ///@param positionManager address of the position manager
    ///@param tokenFromAave address of the token of Aave position
    ///@param tokenId tokenID of the position on uniswap
    ///@param tokenData struct storing data of the position on uniswap
    function _moveToUniswap(
        address positionManager,
        address tokenFromAave,
        uint256 tokenId,
        TokenData memory tokenData
    ) internal {
        uint256 amountWithdrawn = IAaveWithdraw(positionManager).withdrawFromAave(
            tokenFromAave,
            tokenId,
            10_000,
            false
        );

        (uint256 amount0Out, uint256 amount1Out) = ISwapToPositionRatio(positionManager).swapToPositionRatio(
            ISwapToPositionRatio.SwapToPositionInput({
                token0Address: tokenData.token0,
                token1Address: tokenData.token1,
                fee: tokenData.fee,
                amount0In: tokenFromAave == tokenData.token0 ? amountWithdrawn : 0,
                amount1In: tokenFromAave == tokenData.token1 ? amountWithdrawn : 0,
                tickLower: tokenData.tickLower,
                tickUpper: tokenData.tickUpper
            })
        );

        IIncreaseLiquidity(positionManager).increaseLiquidity(tokenId, amount0Out, amount1Out);

        emit MovedToUniswap(positionManager, tokenId, tokenFromAave, amountWithdrawn, tokenId);
    }

    ///@notice compute the address of the token to send to Aave
    ///@param tokenId tokenID of the position to move to Aave
    ///@param token0 address of the token0 coming from uniswap Lp
    ///@param token1 address of the token1 coming from uniswap Lp
    ///@return toAaveToken address of the token to deposit to Aave
    function _calcToAaveToken(
        INonfungiblePositionManager NonFungiblePositionManager,
        uint256 tokenId,
        address token0,
        address token1
    ) internal view returns (address toAaveToken) {
        (, int24 tickPool, , , , , ) = IUniswapV3Pool(
            UniswapNFTHelper._getPoolFromTokenId(
                tokenId,
                NonFungiblePositionManager,
                uniswapAddressHolder.uniswapV3FactoryAddress()
            )
        ).slot0();

        (, , , int24 tickLower, int24 tickUpper) = UniswapNFTHelper._getTokens(tokenId, NonFungiblePositionManager);

        if (tickPool > tickLower && tickPool > tickUpper) toAaveToken = token1;
        else if (tickPool < tickLower && tickPool < tickUpper) toAaveToken = token0;

        require(toAaveToken != address(0), 'AaveModule::_moveToAave: position is in range.');

        require(
            ILendingPool(aaveAddressHolder.lendingPoolAddress()).getReserveData(toAaveToken).aTokenAddress !=
                address(0),
            'AaveModule::_moveToAave: Aave token not found.'
        );
    }

    ///@notice finds the best fee tier on which to perform a swap
    ///@dev this only tracks the currently in range liquidity, disregarding the range that could be reached with our swap
    ///@param token0 address of first token
    ///@param token1 address of second token
    ///@return fee suggested fee tier
    function _findBestFee(address token0, address token1) internal view returns (uint24 fee) {
        uint128 bestLiquidity;
        uint16[4] memory fees = [100, 500, 3000, 10000];

        for (uint256 i; i < 4; ++i) {
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
        return
            IUniswapV3Pool(
                UniswapNFTHelper._getPool(uniswapAddressHolder.uniswapV3FactoryAddress(), token0, token1, fee)
            ).liquidity();
    }
}
