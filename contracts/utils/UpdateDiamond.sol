// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

import '../../interfaces/IDiamondCut.sol';
import '../../interfaces/IRegistry.sol';

contract UpdateDiamond {
    IRegistry public registry;

    modifier onlyGovernance() {
        require(msg.sender == registry.governance(), 'UpdateDiamond::onlyGovernance: Only governance can add actions');
        _;
    }

    constructor(address _registry) {
        registry = IRegistry(_registry);
        require(
            registry.governance() != address(0),
            'UpdateDiamond::constructor: Registry must have a governance address'
        );
    }

    function changeRegistry(address newRegistry) external onlyGovernance {
        registry = IRegistry(newRegistry);
        require(
            registry.governance() != address(0),
            'UpdateDiamond::changeRegistry: Registry must have a governance address'
        );
    }

    function updateDiamond(address positionManager, IDiamondCut.FacetCut[] memory actions) external onlyGovernance {
        bytes memory _calldata;
        IDiamondCut(positionManager).diamondCut(actions, 0x0000000000000000000000000000000000000000, _calldata);
    }
}
