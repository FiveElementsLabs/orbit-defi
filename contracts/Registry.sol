// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

/// @title Stores modules addresses
contract Registry {
    address public governance;

    struct Entry {
        bool activated;
        bool exists;
    }

    mapping(address => Entry) public entries;

    constructor() {
        governance = msg.sender;
    }

    function addNewContract(address _contractAddr) external onlyGovernance {
        require(!entries[_contractAddr].exists, 'Entry already exists');
        entries[_contractAddr] = Entry({activated: true, exists: true});
    }

    function isApproved(address _contractAddr) public view returns (bool) {
        return entries[_contractAddr].activated;
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, 'Only governance');
        _;
    }
}
