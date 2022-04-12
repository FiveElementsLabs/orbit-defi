// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../../interfaces/IPositionManager.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../helpers/NFTHelper.sol';
import '../helpers/ERC20Helper.sol';
import '../utils/Storage.sol';
import '../actions/CollectFees.sol';
import '../actions/IncreaseLiquidity.sol';
import '../actions/UpdateUncollectedFees.sol';

contract AutoCompoundModule {
    //TODO: setup registry
    IUniswapAddressHolder addressHolder;
    uint256 feesThreshold;

    constructor(address _addressHolder, uint256 _feesThreshold) {
        addressHolder = IUniswapAddressHolder(_addressHolder);
        feesThreshold = _feesThreshold;
    }

    ///@notice executes our recipe for autocompounding
    ///@param positionManager address of the position manager
    ///@param tokenId id of the token to autocompound
    function autoCompoundFees(IPositionManager positionManager, uint256 tokenId) public {
        ///@dev check if autocompound is active
        if (positionManager.getModuleState(tokenId, address(this))) {
            ///@dev check if compound need to be done
            if (checkIfCompoundIsNeeded(address(positionManager), tokenId)) {
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
    function checkIfCompoundIsNeeded(address positionManagerAddress, uint256 tokenId) internal returns (bool) {
        (uint256 uncollectedFees0, uint256 uncollectedFees1) = IUpdateUncollectedFees(positionManagerAddress)
            .updateUncollectedFees(tokenId);

        (uint256 amount0, uint256 amount1) = NFTHelper._getAmountsfromTokenId(
            tokenId,
            INonfungiblePositionManager(addressHolder.nonfungiblePositionManagerAddress()),
            addressHolder.uniswapV3FactoryAddress()
        );

        uint256 token0OverFees = 2**256 - 1;
        uint256 token1OverFees = 2**256 - 1;

        if (uncollectedFees0 > 0) {
            token0OverFees = amount0 / uncollectedFees0;
        }
        if (uncollectedFees1 > 0) {
            token1OverFees = amount1 / uncollectedFees1;
        }
        return (token0OverFees < feesThreshold || token1OverFees < feesThreshold);
    }
}
