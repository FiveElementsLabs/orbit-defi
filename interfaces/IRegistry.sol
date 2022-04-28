// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

interface IRegistry {
    struct Entry {
        address contractAddress;
        bool activated;
    }

    ///@notice return the address of PositionManagerFactory
    ///@return address of PositionManagerFactory
    function positionManagerFactoryAddress() external view returns (address);

    ///@notice return the address of Governance
    ///@return address of Governance
    function governance() external view returns (address);

    ///@notice return the address of Governance
    ///@return address of Governance
    function getModuleKeys() external view returns (bytes32[] memory);

    ///@notice return the address of Governance
    ///@return address of Governance
    function isActive(bytes32 _id) external view returns (bool);

    ///@notice return the address of Governance
    ///@return address of Governance
    function moduleAddress(bytes32 _id) external view returns (address);
}
