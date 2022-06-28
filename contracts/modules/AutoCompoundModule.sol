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
import '../../interfaces/actions/IUpdateUncollectedFees.sol';
import '../helpers/UniswapNFTHelper.sol';
import '../utils/Storage.sol';

contract AutoCompoundModule is BaseModule {
    IUniswapAddressHolder public immutable addressHolder;

    using SafeMath for uint256;

    ///@notice emitted when a keeper performsm an autocompound
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
        public
        onlyWhitelistedKeeper
        activeModule(positionManager, tokenId)
    {
        ///@dev check if compound need to be done
        if (_checkIfCompoundIsNeeded(positionManager, tokenId)) {
            (uint256 amount0Desired, uint256 amount1Desired) = ICollectFees(positionManager).collectFees(
                tokenId,
                false
            );

            IIncreaseLiquidity(positionManager).increaseLiquidity(tokenId, amount0Desired, amount1Desired);
            emit AutoCompounded(positionManager, tokenId, amount0Desired, amount1Desired);
        }
    }

    ///@notice checks the position status
    ///@param positionManager address of the position manager
    ///@param tokenId token id of the position
    ///@return true if the position needs to be collected
    function _checkIfCompoundIsNeeded(address positionManager, uint256 tokenId) internal returns (bool) {
        (uint256 uncollectedFees0, uint256 uncollectedFees1) = IUpdateUncollectedFees(positionManager)
            .updateUncollectedFees(tokenId);

        address nonfungiblePositionManagerAddress = addressHolder.nonfungiblePositionManagerAddress();

        (uint256 amount0, uint256 amount1) = UniswapNFTHelper._getAmountsfromTokenId(
            tokenId,
            INonfungiblePositionManager(nonfungiblePositionManagerAddress),
            addressHolder.uniswapV3FactoryAddress()
        );

        (, bytes32 data) = IPositionManager(positionManager).getModuleInfo(tokenId, address(this));
        require(data != bytes32(0), 'AutoCompoundModule::_checkIfCompoundIsNeeded: module data cannot be empty');

        (uint160 sqrtPriceX96, , , , , , ) = IUniswapV3Pool(
            UniswapNFTHelper._getPoolFromTokenId(
                tokenId,
                INonfungiblePositionManager(nonfungiblePositionManagerAddress),
                addressHolder.uniswapV3FactoryAddress()
            )
        ).slot0();

        //returns true if the value of uncollected fees * 100 is greater than amount in the position * threshold:
        //  ((uncollectedFees0 * sqrtPriceX96) / 2**96 + (uncollectedFees1 * 2**96) / sqrtPriceX96)) * 100 >
        //  ((amount0 * sqrtPriceX96) / 2**96 + (amount1 * 2**96) / sqrtPriceX96)) * feesThreshold
        return
            (
                uncollectedFees0.mul(uint256(sqrtPriceX96)).div(2**96).add(
                    uncollectedFees1.mul(2**96).div(uint256(sqrtPriceX96))
                )
            ).mul(100) >
            (amount0.mul(uint256(sqrtPriceX96)).div(2**96).add(amount1.mul(2**96).div(uint256(sqrtPriceX96)))).mul(
                uint256(data)
            );
    }
}
