// SPDX-License-Identifier: GPL-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import '../../interfaces/IPositionManager.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../../interfaces/IAaveAddressHolder.sol';
import '../../interfaces/IDiamondCut.sol';
import '../../interfaces/IRegistry.sol';

struct FacetAddressAndPosition {
    address facetAddress;
    uint96 functionSelectorPosition; // position in facetFunctionSelectors.functionSelectors array
}

struct FacetFunctionSelectors {
    bytes4[] functionSelectors;
    uint256 facetAddressPosition; // position of facetAddress in facetAddresses array
}

struct AavePositions {
    uint256 id;
    address tokenToAave;
}

struct StorageStruct {
    // maps function selector to the facet address and
    // the position of the selector in the facetFunctionSelectors.selectors array
    mapping(bytes4 => FacetAddressAndPosition) selectorToFacetAndPosition;
    // maps facet addresses to function selectors
    mapping(address => FacetFunctionSelectors) facetFunctionSelectors;
    // facet addresses
    address[] facetAddresses;
    IUniswapAddressHolder uniswapAddressHolder;
    address owner;
    IRegistry registry;
    IAaveAddressHolder aaveAddressHolder;
    // key 32bytes => uint32 5bytes => storageVars[uint32] == key
    mapping(uint128 => bytes32) storageVars;
}

library PositionManagerStorage {
    bytes32 private constant key = keccak256('position-manager-storage-location');

    ///@notice get the storage from memory location
    ///@return s the storage struct
    function getStorage() internal pure returns (StorageStruct storage s) {
        bytes32 k = key;
        assembly {
            s.slot := k
        }
    }

    ///@notice emitted when a contract changes ownership
    ///@param previousOwner previous owner of the contract
    ///@param newOwner new owner of the contract
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    ///@notice set the owner field on the storage struct
    ///@param _newOwner new owner of the storage struct
    function setContractOwner(address _newOwner) internal {
        require(_newOwner != address(0), 'Storage::setContractOwner: new owner cannot be the null address');
        StorageStruct storage ds = getStorage();
        address previousOwner = ds.owner;
        ds.owner = _newOwner;
        if (_newOwner != previousOwner) {
            emit OwnershipTransferred(previousOwner, _newOwner);
        }
    }

    ///@notice make sure that a function is called by the PositionManagerFactory contract
    function enforceIsGovernance() internal view {
        StorageStruct storage ds = getStorage();
        require(
            msg.sender == ds.registry.positionManagerFactoryAddress(),
            'Storage::enforceIsGovernance: Must be positionManagerFactory to call this function'
        );
    }

    ///@notice emitted when a facet is cut into the diamond
    ///@param _diamondCut facet cut
    ///@param _init diamond cut init address
    ///@param _calldata facet cut calldata
    event DiamondCut(IDiamondCut.FacetCut[] _diamondCut, address _init, bytes _calldata);

    ///@notice Internal function version of diamondCut
    ///@param _diamondCut facet cut
    ///@param _init diamond cut init address
    ///@param _calldata facet cut calldata
    function diamondCut(
        IDiamondCut.FacetCut[] memory _diamondCut,
        address _init,
        bytes memory _calldata
    ) internal {
        uint256 _diamondCutLength = _diamondCut.length;
        for (uint256 facetIndex; facetIndex < _diamondCutLength; ++facetIndex) {
            IDiamondCut.FacetCutAction action = _diamondCut[facetIndex].action;
            if (action == IDiamondCut.FacetCutAction.Add) {
                addFunctions(_diamondCut[facetIndex].facetAddress, _diamondCut[facetIndex].functionSelectors);
            } else if (action == IDiamondCut.FacetCutAction.Replace) {
                replaceFunctions(_diamondCut[facetIndex].facetAddress, _diamondCut[facetIndex].functionSelectors);
            } else if (action == IDiamondCut.FacetCutAction.Remove) {
                removeFunctions(_diamondCut[facetIndex].facetAddress, _diamondCut[facetIndex].functionSelectors);
            } else {
                revert('LibDiamondCut: Incorrect FacetCutAction');
            }
        }
        emit DiamondCut(_diamondCut, _init, _calldata);
        initializeDiamondCut(_init, _calldata);
    }

    ///@notice Add functions to facet
    ///@param _facetAddress address of the facet
    ///@param _functionSelectors function selectors to add
    function addFunctions(address _facetAddress, bytes4[] memory _functionSelectors) internal {
        require(_functionSelectors.length != 0, 'PositionManagerStorage::addFunctions: No selectors in facet to cut');
        StorageStruct storage ds = getStorage();
        require(_facetAddress != address(0), "PositionManagerStorage::addFunctions: Add facet can't be address(0)");
        uint96 selectorPosition = uint96(ds.facetFunctionSelectors[_facetAddress].functionSelectors.length);

        // add new facet address if it does not exist
        if (selectorPosition == 0) {
            addFacet(ds, _facetAddress);
        }

        uint256 _functionSelectorsLength = _functionSelectors.length;
        for (uint256 selectorIndex; selectorIndex < _functionSelectorsLength; ++selectorIndex) {
            bytes4 selector = _functionSelectors[selectorIndex];
            address oldFacetAddress = ds.selectorToFacetAndPosition[selector].facetAddress;
            require(
                oldFacetAddress == address(0),
                "PositionManagerStorage::addFunctions: Can't add function that already exists"
            );
            addFunction(ds, selector, selectorPosition, _facetAddress);
            selectorPosition++;
        }
    }

    ///@notice Add facet by address
    ///@param ds storage struct
    ///@param _facetAddress address of the facet
    function addFacet(StorageStruct storage ds, address _facetAddress) internal {
        ds.facetFunctionSelectors[_facetAddress].facetAddressPosition = ds.facetAddresses.length;
        ds.facetAddresses.push(_facetAddress);
    }

    ///@notice Add single function to facet
    ///@param ds storage struct
    ///@param _selector function selector to add
    ///@param _selectorPosition position of the function selector in the facetFunctionSelectors array
    function addFunction(
        StorageStruct storage ds,
        bytes4 _selector,
        uint96 _selectorPosition,
        address _facetAddress
    ) internal {
        ds.selectorToFacetAndPosition[_selector].functionSelectorPosition = _selectorPosition;
        ds.facetFunctionSelectors[_facetAddress].functionSelectors.push(_selector);
        ds.selectorToFacetAndPosition[_selector].facetAddress = _facetAddress;
    }

    ///@notice Remove single function from facet
    ///@param ds storage struct
    ///@param _facetAddress address of the facet
    ///@param _selector function selector to remove
    function removeFunction(
        StorageStruct storage ds,
        address _facetAddress,
        bytes4 _selector
    ) internal {
        require(
            _facetAddress != address(0),
            "PositionManagerStorage::removeFunction: Can't remove function that doesn't exist"
        );
        require(
            _facetAddress != address(this),
            "PositionManagerStorage::removeFunction: Can't remove immutable function"
        );

        // replace selector with last selector, then delete last selector
        uint256 selectorPosition = ds.selectorToFacetAndPosition[_selector].functionSelectorPosition;
        uint256 lastSelectorPosition = ds.facetFunctionSelectors[_facetAddress].functionSelectors.length - 1;

        // if not the same then replace _selector with lastSelector
        if (selectorPosition != lastSelectorPosition) {
            bytes4 lastSelector = ds.facetFunctionSelectors[_facetAddress].functionSelectors[lastSelectorPosition];
            ds.facetFunctionSelectors[_facetAddress].functionSelectors[selectorPosition] = lastSelector;
            ds.selectorToFacetAndPosition[lastSelector].functionSelectorPosition = uint96(selectorPosition);
        }

        // delete the last selector
        ds.facetFunctionSelectors[_facetAddress].functionSelectors.pop();
        delete ds.selectorToFacetAndPosition[_selector];

        // if no more selectors for facet address then delete the facet address
        if (lastSelectorPosition == 0) {
            // replace facet address with last facet address and delete last facet address
            uint256 lastFacetAddressPosition = ds.facetAddresses.length - 1;
            uint256 facetAddressPosition = ds.facetFunctionSelectors[_facetAddress].facetAddressPosition;
            if (facetAddressPosition != lastFacetAddressPosition) {
                address lastFacetAddress = ds.facetAddresses[lastFacetAddressPosition];
                ds.facetAddresses[facetAddressPosition] = lastFacetAddress;
                ds.facetFunctionSelectors[lastFacetAddress].facetAddressPosition = facetAddressPosition;
            }
            ds.facetAddresses.pop();
            delete ds.facetFunctionSelectors[_facetAddress].facetAddressPosition;
        }
    }

    ///@notice Replace functions in facet
    ///@param _facetAddress address of the facet
    ///@param _functionSelectors function selectors to replace
    function replaceFunctions(address _facetAddress, bytes4[] memory _functionSelectors) internal {
        require(
            _functionSelectors.length != 0,
            'PositionManagerStorage::replaceFunctions: No selectors in facet to cut'
        );
        StorageStruct storage ds = getStorage();
        require(_facetAddress != address(0), "PositionManagerStorage::replaceFunctions: Add facet can't be address(0)");
        uint96 selectorPosition = uint96(ds.facetFunctionSelectors[_facetAddress].functionSelectors.length);

        // add new facet address if it does not exist
        if (selectorPosition == 0) {
            addFacet(ds, _facetAddress);
        }

        uint256 _functionSelectorsLength = _functionSelectors.length;
        for (uint256 selectorIndex; selectorIndex < _functionSelectorsLength; ++selectorIndex) {
            bytes4 selector = _functionSelectors[selectorIndex];
            address oldFacetAddress = ds.selectorToFacetAndPosition[selector].facetAddress;

            require(
                oldFacetAddress != _facetAddress,
                "PositionManagerStorage::replaceFunctions: Can't replace function with same function"
            );

            removeFunction(ds, oldFacetAddress, selector);
            addFunction(ds, selector, selectorPosition, _facetAddress);
            selectorPosition++;
        }
    }

    ///@notice remove functions in facet
    ///@param _facetAddress address of the facet
    ///@param _functionSelectors function selectors to remove
    function removeFunctions(address _facetAddress, bytes4[] memory _functionSelectors) internal {
        require(
            _functionSelectors.length != 0,
            'PositionManagerStorage::removeFunctions: No selectors in facet to cut'
        );

        StorageStruct storage ds = getStorage();

        require(
            _facetAddress == address(0),
            'PositionManagerStorage::removeFunctions: Remove facet address must be address(0)'
        );

        uint256 _functionSelectorsLength = _functionSelectors.length;
        for (uint256 selectorIndex; selectorIndex < _functionSelectorsLength; ++selectorIndex) {
            bytes4 selector = _functionSelectors[selectorIndex];
            address oldFacetAddress = ds.selectorToFacetAndPosition[selector].facetAddress;
            removeFunction(ds, oldFacetAddress, selector);
        }
    }

    ///@notice Initialize the diamond cut
    ///@param _init delegatecall address
    ///@param _calldata delegatecall data
    function initializeDiamondCut(address _init, bytes memory _calldata) internal {
        if (_init == address(0)) {
            require(
                _calldata.length == 0,
                'PositionManagerStorage::initializeDiamondCut: _init is address(0) but_calldata is not empty'
            );
        } else {
            require(
                _calldata.length != 0,
                'PositionManagerStorage::initializeDiamondCut: _calldata is empty but _init is not address(0)'
            );

            (bool success, bytes memory error) = _init.delegatecall(_calldata);

            if (!success) {
                if (error.length != 0) {
                    revert(string(error));
                } else {
                    revert('PositionManagerStorage::initializeDiamondCut: _init function reverted');
                }
            }
        }
    }

    ///@notice check to verify that the key is valid and already whitelisted by governance
    ///@param hashedKey key to check
    modifier verifyKey(bytes32 hashedKey) {
        StorageStruct storage ds = getStorage();
        bytes16 y;

        assembly {
            y := shl(128, hashedKey)
        }

        bytes32 storageVariableHash = ds.storageVars[uint128(y)];

        require(
            storageVariableHash == hashedKey,
            'PositionManagerStorage::getDynamicStorage: Key does not exist on storage'
        );
        _;
    }

    ///@notice get a specific slot of memory by the given key and read the first 32 bytes
    ///@param hashedKey key to read from
    function getDynamicStorageValue(bytes32 hashedKey) internal view verifyKey(hashedKey) returns (bytes32 value) {
        assembly {
            value := sload(hashedKey)
        }
    }

    ///@dev supposing we've already set the key on the mapping, we can't insert a wrong key
    ///@notice set a specific slot of memory by the given key and write the first 32 bytes
    ///@param hashedKey key to write to
    ///@param value value to write
    function setDynamicStorageValue(bytes32 hashedKey, bytes32 value) internal verifyKey(hashedKey) {
        assembly {
            sstore(hashedKey, value)
        }
    }

    ///@notice add a new hashedKey to the mapping in storage, sort of whitelist
    ///@param hashedKey key to add to the mapping
    function addDynamicStorageKey(bytes32 hashedKey) internal {
        StorageStruct storage ds = getStorage();
        bytes16 y;

        assembly {
            y := shl(128, hashedKey)
        }

        bytes32 storageVariableHash = ds.storageVars[uint128(y)];

        ///@dev return if the key already exists
        if (storageVariableHash != bytes32(0)) return;

        ds.storageVars[uint128(y)] = hashedKey;
    }
}
