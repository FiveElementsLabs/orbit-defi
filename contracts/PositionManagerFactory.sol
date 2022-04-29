// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import './PositionManager.sol';
import '../interfaces/IPositionManagerFactory.sol';

contract PositionManagerFactory is IPositionManagerFactory {
    address[] public positionManagers;
    mapping(address => address) public override userToPositionManager;

    event PositionManagerCreated(address indexed contractAddress, address userAddress, address uniswapAddressHolder);

    ///@notice deploy new positionManager and assign to userAddress
    ///@param _userAddress the address of the user that will be the owner of PositionManager
    ///@param _diamondCutFacet the address of the DiamondCutFacet contract
    ///@param _uniswapAddressHolderAddress the address of the UniswapAddressHolder contract
    ///@param _registryAddress the address of the Registry contract
    ///@return address[] return array of PositionManager address updated with the last deployed PositionManager
    function create(
        address _userAddress,
        address _diamondCutFacet,
        address _uniswapAddressHolderAddress,
        address _registryAddress,
        address _aaveAddressHolderAddress
    ) external override returns (address[] memory) {
        PositionManager manager = new PositionManager(_userAddress, _diamondCutFacet, _registryAddress);
        positionManagers.push(address(manager));
        userToPositionManager[_userAddress] = address(manager);
        manager.init(_userAddress, _uniswapAddressHolderAddress, _registryAddress, _aaveAddressHolderAddress);
        emit PositionManagerCreated(address(manager), _userAddress, _uniswapAddressHolderAddress);

        return positionManagers;
    }

    ///@notice get all positionManager array of address
    ///@dev array need to return with a custom function to get all the array
    ///@return address[] return the array of positionManager
    function getAllPositionManagers() external view override returns (address[] memory) {
        return positionManagers;
    }
}
