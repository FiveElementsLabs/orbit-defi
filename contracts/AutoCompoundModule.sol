// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import './interfaces/IPositionManager.sol'; //interface for PositionManager to be done

contract AutoCompoundModule {
    uint256 uncollectedFeesThreshold; //used to decide if fees should be collected

    constructor(uint256 threshold) {
        uncollectedFeesThreshold = threshold;
    }

    function checkForUncollectedFees(IPositionManager positionManager, uint256 tokenId)
        public
        returns (uint128, uint128)
    {
        return positionManager.getPositionFee(tokenId);
    }

    function collectFees(IPositionManager positionManager, uint256 tokenId) public returns (address[], uint256[]) {
        (tokens, amounts) = positionManager.collectFees(tokenId);
        return (tokens, amounts);
    }

    function reinvestFees(
        IPositionManager positionManager,
        uint256 tokenId,
        uint256 amount0,
        uint256 amount1
    ) {

        positionManager.increasePositionLiquidity(tokenId, amount0, amount1);
    }

    function checkAndCompound(IPositionManager positionManager) public{
        tokenIds = positionManager.getUniswapNFTs();
        for(i=0; i<tokenIds.length(); i++){
            (uint128 token0Fees, uint128 token1Fees) = checkForUncollectedFees(positionManager.address, tokenIds[i]);
            if(min(token0Fees,token1Fees)>uncollectedFeesThreshold){
                collectFees(positionManager.address, tokenIds[i]);
                reinvestFees(positionManager.address, tokenIds[i], token0Fees, token1Fees);
            }
        }
    }
}
