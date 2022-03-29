// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

///@notice each action should inherit from this contract
abstract contract BaseAction {
    ///@notice do the action of this contract
    ///@param inputs bytes to be decoded by decodeInputs function
    ///@param outputs bytes encoded by encodeOutputs function
    function doAction(bytes memory inputs) public virtual returns (bytes memory outputs);
}
