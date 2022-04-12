// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

/// @title Stores all the modules addresses
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

    ///@notice Register a module
    ///@param _id keccak256 of module id string
    ///@param _contractAddress address of the new module
    function addNewContract(bytes32 _id, address _contractAddress) external onlyGovernance {
        require(!modules[_id].exists, 'Entry already exists');
        modules[_id] = Entry({contractAddress: _contractAddress, activated: true, exists: true});
    }

    ///@notice Changes a module's address
    ///@param _id keccak256 of module id string
    ///@param _newContractAddress address of the new module
    function changeContract(bytes32 _id, address _newContractAddress) external onlyGovernance {
        require(modules[_id].exists, 'Entry does not exist');
        //Begin timelock
        modules[_id].contractAddress = _newContractAddress;
    }

    ///@notice Toggle global state of a module
    ///@param _id keccak256 of module id string
    ///@param _activated boolean to activate or deactivate module
    function toggleModule(bytes32 _id, bool _activated) external onlyGovernance {
        require(modules[_id].exists, 'Entry does not exist');
        modules[_id].activated = _activated;
    }

    ///@notice Get the state of a module
    ///@param _id keccak256 of module id string
    ///@return bool activated
    function isActive(bytes32 _id) public view returns (bool) {
        return modules[_id].activated;
    }

    ///@notice modifier to check if the sender is the governance contract
    modifier onlyGovernance() {
        require(msg.sender == governance, 'Only governance function');
        _;
    }
}
