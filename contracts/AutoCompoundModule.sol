// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../interfaces/IVault.sol'; //interface for PositionManager to be done
import 'hardhat/console.sol';
import '@openzeppelin/contracts/math/Math.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract AutoCompoundModule {
    using SafeMath for uint256;

    // TODO: make user choose threshold from pos manager
    uint256 uncollectedFeesThreshold = 33; //used to decide if fees should be collected

    struct VaultFee {
        uint256 tokenId;
        uint128 feeToken0;
        uint128 feeToken1;
    }

    constructor() {
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

    function collectFees(
        IVault positionManager,
        address token0Address,
        address token1Address
    ) public {
        VaultFee[] memory allFee = checkForAllUncollectedFees(positionManager);
        uint256 amount0;
        uint256 amount1;
        bool checkFee;
        IERC20 token0 = IERC20(token0Address);
        IERC20 token1 = IERC20(token1Address);

        _approveToken(token0, positionManager);
        _approveToken(token1, positionManager);

        for (uint32 i = 0; i < allFee.length; i++) {
            checkFee = _feeNeedToBeReinvested(positionManager, allFee[i]);
            if (checkFee) {
                (amount0, amount1) = positionManager.collectPositionFee(allFee[i].tokenId, address(this));

                positionManager.increasePositionLiquidity(allFee[i].tokenId, amount0, amount1);
            }
        }
    }

    function reinvestFees(
        IVault positionManager,
        uint256 tokenId,
        uint256 amount0,
        uint256 amount1
    ) public {
        positionManager.increasePositionLiquidity(tokenId, amount0, amount1);
    }

    function _feeNeedToBeReinvested(IVault positionManager, VaultFee memory feeXToken) private view returns (bool) {
        (uint256 token0, uint256 token1) = positionManager.getPositionBalance(feeXToken.tokenId);
        uint256 token0OverFees = 2**256 - 1;
        uint256 token1OverFees = 2**256 - 1;
        if (feeXToken.feeToken0 > 0) {
            token0OverFees = token0.div(feeXToken.feeToken0);
        }
        if (feeXToken.feeToken1 > 0) {
            token1OverFees = token1.div(feeXToken.feeToken1);
        }

        return Math.min(token0OverFees, token1OverFees) < uncollectedFeesThreshold;
    }

    function _approveToken(IERC20 token, IVault positionManager) private {
        if (token.allowance(address(this), address(positionManager)) == 0)
            token.approve(address(positionManager), 2**256 - 1);
    }
}
