// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

interface IRegistry {
    struct Entry {
        address contractAddress;
        bool activated;
    }

    function getModuleKeys() external view returns (bytes32[] memory);

    function isActive(bytes32 _id) external view returns (bool);

    function moduleAddress(bytes32 _id) external view returns (address);
}
