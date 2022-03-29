// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

library ERC20Helper {
    ///@dev library to interact with ERC20 token
    using SafeERC20 for IERC20;

    ///@notice approve the token to be able to transfer it
    ///@param token address of the token
    ///@param spender address of the spender
    ///@param balance address of the balance
    function _approveToken(
        address token,
        address spender,
        uint256 amount
    ) internal {
        IERC20(token).approve(spender, amount);
    }

    ///@notice return the allowance of the token that spender is able to spend
    ///@param token address of the token
    ///@param owner address of the owner
    ///@param spender address of the spender
    ///@return uint256 amount of the allowance
    function _getAllowance(
        address token,
        address owner,
        address spender
    ) internal view returns (uint256) {
        return IERC20(token).allowance(owner, spender);
    }

    ///@notice pull token if it is below the threshold of amount
    ///@param token address of the token
    ///@param from address of the from
    ///@param amount address of the amount
    ///@return uint256 amount of the token that was pulled
    function _pullTokensIfNeeded(
        address token,
        address from,
        uint256 amount
    ) internal returns (uint256) {
        bool done = false;
        uint256 balance = getBalance(token, address(this));
        if (balance < amount) {
            uint256 needed = amount - balance;
            if (needed < getBalance(token, from)) {
                done = IERC20(token).safeTransferFrom(from, address(this), needed);
            }
        }
        return done ? needed : 0;
    }

    ///@notice withdraw the tokens from the vault and send them to the user
    ///@param token address of the token
    ///@param to address of the user
    ///@param amount amount of tokens to withdraw
    function _withdrawTokens(
        address token,
        address to,
        uint256 amount
    ) internal {
        uint256 balance = _getBalance(token, address(this));
        if (balance < amount) {
            amount = balance;
        }
        IERC20(token).safeTransferFrom(address(this), to, amount);
    }

    ///@notice get the balance of the token for the given address
    ///@param token address of the token
    ///@param account address of the account
    ///@return uint256 return the balance of the token for the given address
    function _getBalance(address token, address account) internal view returns (uint256) {
        return IERC20(token).balanceOf(account);
    }
}
