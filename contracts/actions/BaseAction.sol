// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

abstract contract BaseAction {
    function doAction(bytes memory inputs) public virtual returns (bytes memory outputs);
}
