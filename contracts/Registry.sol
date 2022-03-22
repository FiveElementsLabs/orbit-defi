// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

/// @title Stores all the important DFS addresses and can be changed (timelock)
contract Registry {

    address public owner;

    struct Entry {
        address contractAddr;
        bool activated;
        bool exists;
    }

    mapping(bytes32 => Entry) public entries;

    constructor () {
        owner = msg.sender;
    }

    function addNewContract(
        bytes32 _id,
        address _contractAddr
    ) public onlyOwner {
        require(!entries[_id].exists, "Entry already exists");

        entries[_id] = Entry({
            contractAddr: _contractAddr,
            activated: true,
            exists: true
        });
    }

    /// @notice Given an contract id returns the registered address
    /// @dev Id is keccak256 of the contract name
    /// @param _id Id of contract
    function getAddr(bytes32 _id) public view returns (address) {
        return entries[_id].contractAddr;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
}