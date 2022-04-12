// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

/// @title Stores all the important module addresses
contract Registry {
    address public governance;

    struct Entry {
        address contractAddress;
        bool activated;
        bool exists;
    }

    mapping(bytes32 => Entry) public modules;

    constructor() {
        governance = msg.sender;
    }

    function addNewContract(bytes32 _id, address _contractAddr) external onlyGovernance {
        require(!modules[_id].exists, 'Entry already exists');
        modules[_id] = Entry({contractAddress: _contractAddr, activated: true, exists: true});
    }

    function changeContract(bytes32 _id, address _newContractAddr) external onlyGovernance {
        require(modules[_id].exists, 'Entry does not exist');
        //Begin timelock
        modules[_id].contractAddress = _newContractAddr;
    }

    function toggleModule(bytes32 _id, bool _activated) external onlyGovernance {
        require(modules[_id].exists, 'Entry does not exist');
        modules[_id].activated = _activated;
    }

    function isActive(bytes32 _id) public view returns (bool) {
        return modules[_id].activated;
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, 'Only governance');
        _;
    }
}
