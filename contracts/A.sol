// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import './utils/Storage.sol';
import 'hardhat/console.sol';

interface IA {
    function getA() external view returns (address);
}

contract A {
    function getA() public view returns (address) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        return Storage.owner;
    }
}
