// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

/// @title Stores all the important module addresses
contract Registry {
    address public owner;

    struct Entry {
        bool activated;
        bool exists;
    }

    mapping(address => Entry) public entries;

    constructor(address _owner) {
        owner = _owner;
    }

    function addNewContract(address _contractAddr) external onlyOwner {
        require(!entries[_contractAddr].exists, 'Registry::addNewContract: Entry already exists.');
        entries[_contractAddr] = Entry({activated: true, exists: true});
    }

    function isApproved(address _contractAddr) public view returns (bool) {
        return entries[_contractAddr].activated;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, 'Registry::onlyOwner: Call must come from owner.');
        _;
    }
}
