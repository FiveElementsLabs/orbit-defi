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
        //if active, check for uncollected fees for each of them
        for (uint256 i = 0; i < positionManagers.length; i++) {
            IPositionManager positionManager = positionManagers[i];
            if (positionManager.isAutoCompound()) {
                uncollectedFees = checkForAllUncollectedFees(positionManagers[i]);
                //if uncollected fees are above threshold, collect fees and reinvest
                if (feesAreOverTrhreshold(uncollectedFees)) {
                    PositionManager.doAction(collectFeesAddress, abi.encode(tokenId));
                    PositionManager.doAction(reinvestFees, qualcosa);
                }
            }
        }
    }
}
