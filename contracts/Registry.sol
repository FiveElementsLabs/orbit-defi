// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '../interfaces/IRegistry.sol';

/// @title Stores all the modules addresses
contract Registry is IRegistry {
    address public override governance;
    address public override positionManagerFactoryAddress;

    mapping(bytes32 => Entry) public modules;
    bytes32[] public moduleKeys;

    event RegistryNewGovernance(address indexed _newGovernance);

    constructor(address _governance, address _positionManagerFactoryAddress) {
        require(_governance != address(0), 'Registry:changeGovernance:: governance address is 0');
        require(
            _positionManagerFactoryAddress != address(0),
            'Registry:changeGovernance:: positionManagerFactoryAddress address is 0'
        );
        governance = _governance;
        positionManagerFactoryAddress = _positionManagerFactoryAddress;
    }

    ///@notice change the address of the governance
    ///@param _governance the address of the new governance
    function changeGovernance(address _governance) external onlyGovernance {
        require(_governance != address(0), 'Registry:changeGovernance:: new governance address is 0');
        governance = _governance;
        emit RegistryNewGovernance(_governance);
    }

    ///@notice Register a module
    ///@param _id keccak256 of module id string
    ///@param _contractAddress address of the new module
    function addNewContract(bytes32 _id, address _contractAddress) external onlyGovernance {
        require(modules[_id].contractAddress == address(0), 'Registry::addNewContract: Entry already exists.');
        modules[_id] = Entry({contractAddress: _contractAddress, activated: true});
        moduleKeys.push(_id);
    }

    ///@notice Changes a module's address
    ///@param _id keccak256 of module id string
    ///@param _newContractAddress address of the new module
    function changeContract(bytes32 _id, address _newContractAddress) external onlyGovernance {
        require(modules[_id].contractAddress != address(0), 'Registry::changeContract: Entry does not exist.');
        //Begin timelock
        modules[_id].contractAddress = _newContractAddress;
    }

    ///@notice Toggle global state of a module
    ///@param _id keccak256 of module id string
    ///@param _activated boolean to activate or deactivate module
    function switchModuleState(bytes32 _id, bool _activated) external onlyGovernance {
        require(modules[_id].contractAddress != address(0), 'Registry::switchModuleState: Entry does not exist.');
        modules[_id].activated = _activated;
    }

    ///@notice Get the keys for all modules
    ///@return bytes32[] all module keys
    function getModuleKeys() external view override returns (bytes32[] memory) {
        return moduleKeys;
    }

    ///@notice Get the address of a module for a given key
    ///@param _id keccak256 of module id string
    ///@return address of the module
    function moduleAddress(bytes32 _id) external view override returns (address) {
        return modules[_id].contractAddress;
    }

    ///@notice Get the state of a module
    ///@param _id keccak256 of module id string
    ///@return bool activated
    function isActive(bytes32 _id) external view override returns (bool) {
        return modules[_id].activated;
    }

    ///@notice modifier to check if the sender is the governance contract
    modifier onlyGovernance() {
        require(msg.sender == governance, 'Registry::onlyGovernance: Call must come from governance.');
        _;
    }
}
