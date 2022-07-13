// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/math/SafeMath.sol';
import './BaseModule.sol';
import '../../interfaces/IPositionManager.sol';
import '../../interfaces/IRegistry.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../../interfaces/actions/ICollectFees.sol';
import '../../interfaces/actions/IIncreaseLiquidity.sol';
import '../../interfaces/actions/ISwapToPositionRatio.sol';
import '../../interfaces/actions/IUpdateUncollectedFees.sol';
import '../helpers/UniswapNFTHelper.sol';
import '../utils/Storage.sol';

contract AutoCompoundModule is BaseModule {
    IUniswapAddressHolder public immutable addressHolder;
    uint256 public constant Q96 = 2**96;

    using SafeMath for uint256;

    ///@notice emitted when a keeper performs an autocompound
    ///@param positionManager address of the called position manager
    ///@param tokenId tokenId of the position
    ///@param amount0 amount of token0 autocompounded
    ///@param amount1 amount of token1 autocompounded
    event AutoCompounded(address indexed positionManager, uint256 tokenId, uint256 amount0, uint256 amount1);

    ///@notice constructor of autoCompoundModule
    ///@param _addressHolder the address of the uniswap address holder contract
    ///@param _registry the address of the registry contract
    constructor(address _addressHolder, address _registry) BaseModule(_registry) {
        require(_addressHolder != address(0), 'AutoCompoundModule::Constructor:addressHolder cannot be 0');
        require(_registry != address(0), 'AutoCompoundModule::Constructor:registry cannot be 0');
        addressHolder = IUniswapAddressHolder(_addressHolder);
    }

    ///@notice executes our recipe for autocompounding
    ///@param positionManager address of the position manager
    ///@param tokenId id of the token to autocompound
    function autoCompoundFees(address positionManager, uint256 tokenId)
        external
        onlyWhitelistedKeeper
        activeModule(positionManager, tokenId)
    {
        (uint256 uncollectedFees0, uint256 uncollectedFees1) = IUpdateUncollectedFees(positionManager)
            .updateUncollectedFees(tokenId);

        INonfungiblePositionManager NonfungiblePositionManager = INonfungiblePositionManager(
            addressHolder.nonfungiblePositionManagerAddress()
        );
        address uniswapV3FactoryAddress = addressHolder.uniswapV3FactoryAddress();

        (uint256 amount0, uint256 amount1) = UniswapNFTHelper._getAmountsfromTokenId(
            tokenId,
            NonfungiblePositionManager,
            uniswapV3FactoryAddress
        );

        (, bytes32 data) = IPositionManager(positionManager).getModuleInfo(tokenId, address(this));
        require(data != bytes32(0), 'AutoCompoundModule::_checkIfCompoundIsNeeded: module data cannot be empty');

        (uint160 sqrtPriceX96, , , , , , ) = IUniswapV3Pool(
            UniswapNFTHelper._getPoolFromTokenId(tokenId, NonfungiblePositionManager, uniswapV3FactoryAddress)
        ).slot0();

        ///@dev check if compound need to be done
        if (_isThresholdReached(amount0, amount1, uncollectedFees0, uncollectedFees1, sqrtPriceX96, uint256(data))) {
            _performAutoCompound(NonfungiblePositionManager, positionManager, tokenId);
        } else revert('AutoCompoundModule::autoCompoundFees: not needed.');
    }

    function _performAutoCompound(
        INonfungiblePositionManager NonfungiblePositionManager,
        address positionManager,
        uint256 tokenId
    ) internal {
        (uint256 amount0Desired, uint256 amount1Desired) = ICollectFees(positionManager).collectFees(tokenId, false);

        (address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper) = UniswapNFTHelper._getTokens(
            tokenId,
            NonfungiblePositionManager
        );

        (amount0Desired, amount1Desired) = ISwapToPositionRatio(positionManager).swapToPositionRatio(
            ISwapToPositionRatio.SwapToPositionInput({
                token0Address: token0,
                token1Address: token1,
                fee: fee,
                amount0In: amount0Desired,
                amount1In: amount1Desired,
                tickLower: tickLower,
                tickUpper: tickUpper
            })
        );

        IIncreaseLiquidity(positionManager).increaseLiquidity(tokenId, amount0Desired, amount1Desired);
        emit AutoCompounded(positionManager, tokenId, amount0Desired, amount1Desired);
    }

    ///@notice returns true if the value of uncollected fees * 100 is greater than amount in the position * threshold:
    //  ((uncollectedFees0 * sqrtPriceX96) / 2**96 + (uncollectedFees1 * 2**96) / sqrtPriceX96)) * 100 >
    //  ((amount0 * sqrtPriceX96) / 2**96 + (amount1 * 2**96) / sqrtPriceX96)) * feesThreshold
    ///@param amount0 amount of token0 in the position
    ///@param amount1 amount of token1 in the position
    ///@param uncollectedFees0 amount of token0 uncollected fees
    ///@param uncollectedFees1 amount of token1 uncollected fees
    ///@param sqrtPriceX96 sqrt of the price of the token in the position
    ///@param threshold percentage of fees that is needed at minimum to trigger a collect
    function _isThresholdReached(
        uint256 amount0,
        uint256 amount1,
        uint256 uncollectedFees0,
        uint256 uncollectedFees1,
        uint256 sqrtPriceX96,
        uint256 threshold
    ) internal pure returns (bool) {
        uint256 uncollectedFees = uncollectedFees0.mul(sqrtPriceX96).div(Q96).add(
            uncollectedFees1.mul(Q96).div(sqrtPriceX96)
        );
        uint256 amount = amount0.mul(sqrtPriceX96).div(Q96).add(amount1.mul(Q96).div(sqrtPriceX96));
        return uncollectedFees.mul(100) > amount.mul(threshold);
    }
}
