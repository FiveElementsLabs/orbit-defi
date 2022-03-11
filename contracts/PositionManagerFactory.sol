/*
 - import PositionManager.sol
 - define PositionManagerFactory.sol
 - create in PositionManagerFactory
*/

//SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import './PositionManager.sol';

contract PositionManagerFactory {
    PositionManager[] public positionManagers;

    function create(
        address userAddress,
        INonfungiblePositionManager _nonfungiblePositionManager,
        IUniswapV3Pool _pool
    ) public {
        PositionManager positionManager = new PositionManager(userAddress, _nonfungiblePositionManager, _pool);
        positionManagers.push(positionManager);
    }
}
