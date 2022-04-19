/* // SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

struct FacetAddressAndPosition {
    address facetAddress;
    uint96 functionSelectorPosition; // position in facetFunctionSelectors.functionSelectors array
}

struct FacetFunctionSelectors {
    bytes4[] functionSelectors;
    uint256 facetAddressPosition; // position of facetAddress in facetAddresses array
}

struct StorageStruct {
    // maps function selector to the facet address and
    // the position of the selector in the facetFunctionSelectors.selectors array
    mapping(bytes4 => FacetAddressAndPosition) selectorToFacetAndPosition;
    // maps facet addresses to function selectors
    mapping(address => FacetFunctionSelectors) facetFunctionSelectors;
    // facet addresses
    address[] facetAddresses;
    address uniswapAddressHolder;
    address aaveAddressHolder;
    address owner;
    address registry;
}

library PositionManagerStorage {
    bytes32 constant key = keccak256('position-manager-storage-location');

    function getStorage() internal pure returns (StorageStruct storage s) {
        bytes32 k = key;
        assembly {
            s.slot := k
        }
    }
}
 */