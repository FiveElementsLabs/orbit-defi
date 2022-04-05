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
    ) {
        addressHolder = IUniswapAddressHolder(_addressHolder);
        feesThreshold = _feesThreshold;
        collectFeeAddress = _collectFeeAddress;
        increaseLiquidityAddress = _increaseLiquidityAddress;
        decreaseLiquidityAddress = _decreaseLiquidityAddress;
    }

    function doMyThing(address positionManagerAddress) public {
        IPositionManager positionManager = IPositionManager(positionManagerAddress);
        //check if autocompound is active
        if (
            true /*positionManager.isAutoCompound()*/
        ) {
            //TODO: check if autocompound module is active
            uint256[] memory positions = positionManager.getAllUniPosition();
            for (uint256 i = 0; i < positions.length; i++) {
                if (checkForPosition(positionManagerAddress, positions[i])) {
                    bytes memory data = positionManager.doAction(collectFeeAddress, abi.encode(positions[i]));
                    (uint256 amount0Collected, uint256 amount1Collected) = abi.decode(data, (uint256, uint256));
                    data = positionManager.doAction(
                        increaseLiquidityAddress,
                        abi.encode(positions[i], amount0Collected, amount1Collected)
                    );

                    //do the output thing
                }
            }
        }
    }

    function checkForPosition(address positionManagerAddress, uint256 tokenId) internal view returns (bool) {
        (bool success, bytes memory data) = positionManagerAddress.staticcall(
            abi.encodeWithSignature(
                'function doAction(address actionAddress, bytes memory inputs)',
                decreaseLiquidityAddress,
                abi.encode(tokenId, 1, 1)
            )
        );
        if (success) {
            (, uint256 uncollectedFees0, uint256 uncollectedFees1) = abi.decode(data, (uint128, uint256, uint256)); //TBD
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
            INonfungiblePositionManager(addressHolder.nonfungiblePositionManagerAddress()),
            addressHolder.uniswapV3FactoryAddress()
        );

        return (amount0 / uncollectedFees0 < feesThreshold || amount1 / uncollectedFees1 < feesThreshold);
    }
}
