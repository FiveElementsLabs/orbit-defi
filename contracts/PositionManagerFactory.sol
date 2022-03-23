// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import './PositionManager.sol';

contract PositionManagerFactory {
    address[] public positionManagers;
    event PositionManagerCreated(
        address indexed contractAddress,
        address userAddress,
        address nonfungiblePositionManager,
        address swapRouter
    );

    function create(
        address userAddress,
        INonfungiblePositionManager _nonfungiblePositionManager,
        ISwapRouter _swapRouter
    ) public returns (address[] memory) {
        PositionManager manager = new PositionManager(userAddress, _nonfungiblePositionManager, _swapRouter);
        positionManagers.push(address(manager));
        emit PositionManagerCreated(
            address(manager),
            userAddress,
            address(_nonfungiblePositionManager),
            address(_swapRouter)
        );

        return positionManagers;
    }
}
