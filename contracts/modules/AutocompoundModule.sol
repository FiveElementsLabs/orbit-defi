// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../../interfaces/IPositionManager.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../helpers/NFTHelper.sol';

contract AutoCompoundModule {
    //TODO: setup registry
    IUniswapAddressHolder addressHolder;
    uint256 feesThreshold;
    address collectFeeAddress;
    address increaseLiquidityAddress;
    address decreaseLiquidityAddress;

    constructor(
        address _addressHolder,
        uint256 _feesThreshold,
        address _collectFeeAddress,
        address _increaseLiquidityAddress,
        address _decreaseLiquidityAddress
    ) public {
        addressHolder = IUniswapAddressHolder(_addressHolder);
        feesThreshold = _feesThreshold;
        collectFeeAddress = _collectFeeAddress;
        increaseLiquidityAddress = _increaseLiquidityAddress;
        decreaseLiquidityAddress = _decreaseLiquidityAddress;
    }

    function doMyThing(address positionManagerAddress) public {
        IPositionManager positionManager = IPositionManager(positionManagerAddress);
        //check if autocompound is active
        if (positionManager.isAutoCompound()) {
            //TODO: check if autocompound module is active
            uint256[] memory positions = positionManager.getAllUniPosition();
            for (uint256 i = 0; i < positions.length; i++) {
                if (checkForPosition(positionManagerAddress, positions[i])) {
                    (bool success, bytes memory data) = positionManager.doAction(
                        collectFeeAddress,
                        abi.encode(positions[i])
                    );
                    if (success) {
                        (success, data) = positionManager.doAction(
                            increaseLiquidityAddress,
                            abi.encode(increaseparams)
                        );
                        if (success) {
                            //do the output thing
                        } else {
                            revert('Failed to reinvest fees');
                        }
                    } else {
                        revert('Failed to collect fees');
                    }
                }
            }
        }
    }

    function checkForPosition(address positionManagerAddress, uint256 tokenId)
        internal
        view
        returns (uint256 uncollectedFees0, uint256 uncollectedFees1)
    {
        (bool success, bytes memory data) = positionManagerAddress.staticcall(
            decreaseLiquidityAddress, //TBD
            abi.encode(decreaseparams) //TBD
        );
        if (success) {
            (uncollectedFees0, uncollectedFees1) = abi.decode(data); //TBD
            return feesNeedToBeReinvested(uncollectedFees0, uncollectedFees1, tokenId); //TBD
        } else {
            revert('Failed to update liquidity');
        }
    }

    function feesNeedToBeReinvested(
        uint256 uncollectedFees0,
        uint256 uncollectedFees1,
        uint256 tokenId
    ) internal view returns (bool needToBeReinvested) {
        (uint256 amount0, uint256 amount1) = NFTHelper._getAmountsfromTokenId(
            tokenId,
            addressHolder.nonfungiblePositionManagerAddress(),
            addressHolder.uniswapV3FactoryAddress()
        );

        return (amount0 / uncollectedFees0 < feesThreshold || amount1 / uncollectedFees1 < feesThreshold);
    }
}
