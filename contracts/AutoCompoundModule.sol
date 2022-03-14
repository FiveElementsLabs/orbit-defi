// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../interfaces/IVault.sol'; //interface for PositionManager to be done
import 'hardhat/console.sol';
import '@openzeppelin/contracts/math/Math.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

contract AutoCompoundModule {
    using SafeMath for uint256;

    uint256 uncollectedFeesThreshold; //used to decide if fees should be collected

    struct VaultFee {
        uint256 tokenId;
        uint128 feeToken0;
        uint128 feeToken1;
    }

    constructor(uint256 _uncollectedFeesThreshold) {
        uncollectedFeesThreshold = _uncollectedFeesThreshold;
    }

    function checkForAllUncollectedFees(IVault positionManager) public view returns (VaultFee[] memory) {
        uint256[] memory allTokenId = positionManager._getAllUniPosition();
        uint256 size = allTokenId.length;
        VaultFee[] memory allFeeVault = new VaultFee[](size);
        uint128 feeToken0;
        uint128 feeToken1;

        for (uint32 i = 0; i < allTokenId.length; i++) {
            (feeToken0, feeToken1) = positionManager.getPositionFee(allTokenId[i]);
            allFeeVault[i] = VaultFee({tokenId: allTokenId[i], feeToken0: feeToken0, feeToken1: feeToken1});
        }

        return allFeeVault;
    }

    function collectFees(IVault positionManager, uint256 tokenId) public returns (uint256, uint256) {
        (uint256 amount0, uint256 amount1) = positionManager.collectPositionFee(tokenId);
        return (amount0, amount1);
    }

    function reinvestFees(
        IVault positionManager,
        uint256 tokenId,
        uint256 amount0,
        uint256 amount1
    ) public {
        positionManager.increasePositionLiquidity(tokenId, amount0, amount1);
    }

    /* function checkAndCompound(IVault positionManager) public{
        uint256[] memory tokenIds = positionManager.getUniswapNFTs();
        for(uint32 i=0; i<tokenIds.length(); i++){
            (uint128 token0Fees, uint128 token1Fees) = checkForAllUncollectedFees(positionManager.address, tokenIds[i]);
            if(Math.min(token0Fees,token1Fees)>uncollectedFeesThreshold){
                collectFees(positionManager.address, tokenIds[i]);
                reinvestFees(positionManager.address, tokenIds[i], token0Fees, token1Fees);
            }
        }
    } */

    function _feeNeedToBeReinvested(IVault positionManager, VaultFee calldata feeXToken) private view returns (bool) {
        (uint256 token0, uint256 token1) = positionManager.getPositionBalance(feeXToken.tokenId);
        return Math.max(token0.div(feeXToken.feeToken0), token1.div(feeXToken.feeToken1)) < 33;
    }
}
