// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../../interfaces/IRegistry.sol';
import '../../interfaces/IPositionManager.sol';

contract BaseModule {
    IRegistry registry;

    modifier onlyWhitelistedKeeper() {
        require(registry.isWhitelistedKeeper(msg.sender));
        _;
    }

    modifier activeModule(address positionManager, uint256 tokenId) {
        require(
            IPositionManager(positionManager).getModuleState(tokenId, address(this)),
            'AaveModule::activeModule: Module is inactive.'
        );
        _;
    }

    constructor(address _registry) {
        registry = IRegistry(_registry);
    }
}
