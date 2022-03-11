// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

// import IPositionManager.sol

contract AutoCompoundModule {
    uint256 uncollectedFeesThreshold = 0;

    event FeesCollected(address from, address token, uint256 amount);
    event FeesReinvested(address from);

    function checkForUncollectedFees(address positionManagerAddress) public returns (bool) {
        IPositionManager positionManagerInstance = IPositionManager(
            positionManagerAddress,
            nonFungiblePositionManagerAddress
        );

        return positionManagerInstance.getUncollectedFees() > 0;
    }

    function collectFees(address positionManagerAddress)
        public
        returns (
            address,
            address,
            uint256,
            uint256
        )
    {
        IPositionManager positionManagerInstance = IPositionManager(
            positionManagerAddress,
            nonFungiblePositionManagerAddress
        );

        return positionManagerInstance.collectFees();
    }

    function reinvestFees(
        uint256 tokenId,
        uint256 amount0,
        uint256 amount1
    ) {
        IPositionManager positionManagerInstance = IPositionManager(
            ownerOf(tokenId),
            nonFungiblePositionManagerAddress
        );

        positionManagerInstance.addLiquidity();
    }
}
