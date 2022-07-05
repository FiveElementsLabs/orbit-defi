// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

interface IAaveWithdraw {
    ///@notice withdraw from aave some token amount
    ///@param token token address
    ///@param id position to withdraw from
    ///@param partToWithdraw percentage of token to withdraw in base points
    ///@param returnTokensToUser true if withdrawn tokens are sent to positionManager owner
    ///@return amountWithdrawn amount of token withdrawn from aave
    function withdrawFromAaveV2(
        address token,
        uint256 id,
        uint256 partToWithdraw,
        bool returnTokensToUser
    ) external returns (uint256 amountWithdrawn);
}
