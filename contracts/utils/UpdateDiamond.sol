// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

import '../../interfaces/IDiamondCut.sol';

contract UpdateDiamond {
    address public governance;

    modifier onlyGovernance() {
        require(msg.sender == governance, 'UpdateDiamond::onlyGovernance: Only governance can add actions');
        _;
    }

    constructor(address _governance) {
        governance = _governance;
    }

    function changeGovernance(address newGovernance) external onlyGovernance {
        governance = newGovernance;
    }

    function updateDiamond(address positionManager, IDiamondCut.FacetCut[] memory actions) external onlyGovernance {
        bytes memory _calldata;
        IDiamondCut(positionManager).diamondCut(actions, 0x0000000000000000000000000000000000000000, _calldata);
    }
}
