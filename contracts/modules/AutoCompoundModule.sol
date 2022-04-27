// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../../interfaces/IPositionManager.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../helpers/UniswapNFTHelper.sol';
import '../utils/Storage.sol';
import '../actions/CollectFees.sol';
import '../actions/IncreaseLiquidity.sol';
import '../actions/UpdateUncollectedFees.sol';

contract AutoCompoundModule {
    IUniswapAddressHolder addressHolder;

    ///@notice constructor of autoCompoundModule
    ///@param _addressHolder the address of the uniswap address holder contract
    constructor(address _addressHolder) {
        addressHolder = IUniswapAddressHolder(_addressHolder);
    }

    ///@notice executes our recipe for autocompounding
    ///@param positionManager address of the position manager
    ///@param tokenId id of the token to autocompound
    function autoCompoundFees(IPositionManager positionManager, uint256 tokenId) public {
        ///@dev check if autocompound is active
        if (positionManager.getModuleState(tokenId, address(this))) {
            ///@dev check if compound need to be done
            if (_checkIfCompoundIsNeeded(address(positionManager), tokenId)) {
                (uint256 amount0Desired, uint256 amount1Desired) = ICollectFees(address(positionManager)).collectFees(
                    tokenId
                );

                IIncreaseLiquidity(address(positionManager)).increaseLiquidity(tokenId, amount0Desired, amount1Desired);
            }
        }
    }

    ///@notice checks the position status
    ///@param positionManagerAddress address of the position manager
    ///@param tokenId token id of the position
    ///@return true if the position needs to be collected
    function _checkIfCompoundIsNeeded(address positionManagerAddress, uint256 tokenId) internal returns (bool) {
        (uint256 uncollectedFees0, uint256 uncollectedFees1) = IUpdateUncollectedFees(positionManagerAddress)
            .updateUncollectedFees(tokenId);

        (uint256 amount0, uint256 amount1) = UniswapNFTHelper._getAmountsfromTokenId(
            tokenId,
            INonfungiblePositionManager(addressHolder.nonfungiblePositionManagerAddress()),
            addressHolder.uniswapV3FactoryAddress()
        );

        uint256 feesThreshold = abi.decode(
            IPositionManager(positionManagerAddress).getModuleData(tokenId, address(this)),
            (uint256)
        );
        return (uncollectedFees0 * 100 > amount0 * feesThreshold || uncollectedFees1 * 100 > amount1 * feesThreshold);
    }
}
