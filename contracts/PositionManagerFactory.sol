// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import './PositionManager.sol';

contract PositionManagerDelegate {
    address owner;
    PositionManager manager;

    constructor(PositionManager _manager, address _owner) {
        owner = _owner;
        manager = _manager;
    }
}

contract PositionManagerFactory {
    PositionManagerDelegate[] public positionManagers;

    function create(
        address userAddress,
        INonfungiblePositionManager _nonfungiblePositionManager,
        IUniswapV3Pool _pool
    ) public {
        PositionManager manager = new PositionManager(userAddress, _nonfungiblePositionManager, _pool);
        PositionManagerDelegate delegate = new PositionManagerDelegate(manager, address(this));
        positionManagers.push(delegate);
    }

    //This is not needed
    function get() public view returns (PositionManagerDelegate[] memory) {
        return positionManagers;
    }
}
