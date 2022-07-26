# Orbit Dynamic Storage

We propose a change to how we handle part of the storage for Orbit.

- reference branch: [dynamic-storage](https://github.com/FiveElementsLabs/orbit-defi/tree/dynamic-storage)
- reference files: `AaveModule.sol` - `AaveDeposit.sol` - `AaveWithdraw.sol` - `Storage.sol` - `PositionManage.sol` - `WithdrawRecipies.sol`

## Motivation

We want to be able to add key value pairs in the storage of existing Position Managers, in order to add new protocols in the future (for instance Compound, Rari, etc). The storage until now was static, meaning that the `StorageStruct` cannot accomodate for new values.

## Changes

It all starts with a new mapping in the `StorageStruct`. Here is a complete summary of all the changes:

1. **Check for the storageKey**

   Using the first 16 bytes of the storageKey as a key in mapping, returning the original key will prove that the key is correct

```javascript
    ///@dev mapping to keep track of the storageKeys already used
    mapping(uint128 => bytes32) storageVars;

    ///@notice check to verify that the key is valid and already
    ///whitelisted by governance
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
            'PositionManagerStorage::getDynamicStorage: Key does not exist on
            storage'
        );
        _;
    }
```

2. **Add key to the mapping**

   Adding a key to mapping should be done directly from the action that wants to save data on the storage (we already have security checks for the fallback function from PositionManager, so this cannot be called by anyone else)

```javascript
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
```

3. **Get and Set function directly for dynamic storage**

   Using the key, we can Get and Set variables directly on the storage

```javascript
    ///@notice get a specific slot of memory by the given key and read the
    ///first 32 bytes
    ///@param hashedKey key to read from
    function getDynamicStorageValue(bytes32 hashedKey) internal view verifyKey
    (hashedKey) returns (bytes32 value) {
        assembly {
            value := sload(hashedKey)
        }
    }

    ///@dev supposing we've already set the key on the mapping, we can't
    ///insert a wrong key
    ///@notice set a specific slot of memory by the given key and write the
    ///first 32 bytes
    ///@param hashedKey key to write to
    ///@param value value to write
    function setDynamicStorageValue(bytes32 hashedKey, bytes32 value)
    internal verifyKey(hashedKey) {
        assembly {
            sstore(hashedKey, value)
        }
    }
```
