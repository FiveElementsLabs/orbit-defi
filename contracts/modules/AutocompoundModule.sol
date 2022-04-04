// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../../interfaces/IPositionManager.sol';
import '../../interfaces/IRegistry.sol';

contract AutoCompoundModule {
    IRegistry registry;

    constructor(address _registryAddress) {
        registry = IRegisty(_registryAddress);
    }

    function doMyThing() public {
        //get a list of all position managers
        positionManagers = registry.getAllPositionManagers();

        //if autocompound is active, check for uncollected fees and reinvest them
        for (uint256 i = 0; i < positionManagers.length; i++) {
            if (IpositionManager(positionManagers[i]).isAutoCompound()) {
                checkForFeesAndReinvest(positionManagers[i]);
            }
        }
    }

    function checkForFeesAndReinvest(address positionManagerAddress) internal {
        IpositionManager PositionManager = IPositionManager(positionManagerAddress);
        uint256[] memory positions = PositionManager.getAllUniPosition();
        for (uint256 i = 0; i < positions.length; i++) {
            checkForPosition(positionManagerAddress, positions[i]);
            if (feesNeedToBeCollected(positions[i])) {
                (bool success, bytes memory data) = PositionManager.doAction(
                    registry.CollectFeeAddress(),
                    abi.encode(tokenId)
                );
                if (success) {
                    (success, data) = PositionManager.doAction(registry.IncreaseLiquidityAddress(), abi.encode(params));
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

    function checkForPosition(address positionManagerAddress, uint256 tokenId)
        internal
        view
        returns (uint256 uncollectedFees0, uint256 uncollectedFees1)
    {
        IPositionManager PositionManager = IPositionManager(positionManagerAddress);
        uint256[] memory positions = PositionManager.getAllUniPosition();
        for (uint256 i = 0; i < positions.length; i++) {
            (bool success, bytes memory data) = positionManager.staticcall(
                registry.DecreaseLiquidityAddress(),
                abi.encode(params)
            );
            if (success) {
                (uncollectedFees0, uncollectedFees1) = abi.decode(data);
            } else {
                revert('Failed to update liquidity');
            }
        }
        return uncollectedFees;
    }
}
