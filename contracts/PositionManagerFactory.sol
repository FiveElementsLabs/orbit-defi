// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import './PositionManager.sol';

contract PositionManagerFactory {
    address[] public positionManagers;

    event PositionManagerCreated(address indexed contractAddress, address userAddress, address uniswapAddressHolder);

    ///@notice deploy new positionManager and assign to userAddress
    ///@param userAddress the address of the user that will be the owner of PositionManager
    ///@param _uniswapAddressHolderAddress helper uniswapAddressHolder cause PositionManager need it in constructor
    ///@return address[] return array of PositionManager address updated with the last deployed PositionManager
    function create(
        address _userAddress,
        address _diamondCutFacet,
        address _uniswapAddressHolderAddress
    ) public returns (address[] memory) {
        PositionManager manager = new PositionManager(_userAddress, _diamondCutFacet);
        positionManagers.push(address(manager));
        manager.init(_userAddress, _uniswapAddressHolderAddress);
        emit PositionManagerCreated(address(manager), _userAddress, _uniswapAddressHolderAddress);

        return positionManagers;
    }

    ///@notice get all positionManager array of address
    ///@dev array need to return with a custom function to get all the array
    ///@return address[] return the array of positionManager
    function getAllPositionManagers() public view returns (address[] memory) {
        return positionManagers;
    }
}
