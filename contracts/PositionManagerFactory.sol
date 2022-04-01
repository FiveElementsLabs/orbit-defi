// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import './PositionManager.sol';
import '../interfaces/IUniswapAddressHolder.sol';

contract PositionManagerFactory {
    address[] public positionManagers;
    event PositionManagerCreated(address indexed contractAddress, address userAddress, address uniswapAddressHolder);

    function create(address userAddress, address _uniswapAddressHolderAddress) public returns (address[] memory) {
        PositionManager manager = new PositionManager(userAddress, _uniswapAddressHolderAddress);
        positionManagers.push(address(manager));
        emit PositionManagerCreated(address(manager), userAddress, _uniswapAddressHolderAddress);

        return positionManagers;
    }
}
