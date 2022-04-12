// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../../interfaces/IPositionManager.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../helpers/NFTHelper.sol';
import '../helpers/ERC20Helper.sol';

contract AutoCompoundModule {
    //TODO: setup registry
    IUniswapAddressHolder addressHolder;
    address collectFeeAddress;
    address increaseLiquidityAddress;
    address decreaseLiquidityAddress;
    address updateFeesAddress;

    constructor(
        address _addressHolder,
        address _collectFeeAddress,
        address _increaseLiquidityAddress,
        address _decreaseLiquidityAddress,
        address _updateFeesAddress
    ) {
        addressHolder = IUniswapAddressHolder(_addressHolder);
        collectFeeAddress = _collectFeeAddress;
        increaseLiquidityAddress = _increaseLiquidityAddress;
        decreaseLiquidityAddress = _decreaseLiquidityAddress;
        updateFeesAddress = _updateFeesAddress;
    }

    ///@notice executes our recipe for autocompounding
    ///@param positionManagerAddress address of the position manager
    function autoCompoundFees(address positionManagerAddress, uint256 feesThreshold) public {
        IPositionManager positionManager = IPositionManager(positionManagerAddress);
        //check if autocompound is active
        if (
            true /*positionManager.isAutoCompound()*/
        ) {
            //TODO: check if autocompound module is active
            uint256[] memory positions = positionManager.getAllUniPosition();
            for (uint256 i = 0; i < positions.length; i++) {
                if (checkIfCompoundIsNeeded(positionManagerAddress, positions[i], feesThreshold)) {
                    bytes memory data = positionManager.doAction(collectFeeAddress, abi.encode(positions[i]));

                    (uint256 amount0Collected, uint256 amount1Collected) = abi.decode(data, (uint256, uint256));

                    data = positionManager.doAction(
                        increaseLiquidityAddress,
                        abi.encode(positions[i], amount0Collected, amount1Collected)
                    );
                }
            }
        }
    }

    ///@notice checks the position status
    ///@param positionManagerAddress address of the position manager
    ///@param tokenId token id of the position
    ///@return true if the position needs to be collected
    function checkIfCompoundIsNeeded(
        address positionManagerAddress,
        uint256 tokenId,
        uint256 feesThreshold
    ) internal returns (bool) {
        bytes memory data = IPositionManager(positionManagerAddress).doAction(updateFeesAddress, abi.encode(tokenId));

        (uint256 uncollectedFees0, uint256 uncollectedFees1) = abi.decode(data, (uint256, uint256));
        (uint256 amount0, uint256 amount1) = NFTHelper._getAmountsfromTokenId(
            tokenId,
            INonfungiblePositionManager(addressHolder.nonfungiblePositionManagerAddress()),
            addressHolder.uniswapV3FactoryAddress()
        );

        return (uncollectedFees0 * 100 > amount0 * feesThreshold || uncollectedFees1 * 100 > amount1 * feesThreshold);
    }
}
