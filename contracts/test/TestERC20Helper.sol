// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../helper/ERC20Helper.sol';

contract TestERC20Helper is ERC20Helper {
    ///@notice library to interact with ERC20 helper for testing

    ///@notice approve the token to be able to transfer it
    ///@dev _approveToken(address token, address spender, uint256 amount)
    ///@param token address of the token
    ///@param spender address of the spender
    ///@param amount amount to be approved
    function approveToken(
        address token,
        address spender,
        uint256 amount
    ) public {
        _approveToken(token, spender, amount);
    }

    ///@notice transfer the token to the spender
    ///@dev _getBalance(address token, address account)
    ///@param token address of the token
    ///@param account address of the owner
    function getBalance(address token, address account) public {
        _getBalance(token, account);
    }

    ///@notice return the allowance of the token that spender is able to spend
    ///@dev _getAllowance(address token, address owner, address spender)
    ///@param token address of the token
    ///@param owner address of the owner
    ///@param spender address of the spender
    ///@return uint256 amount of the allowance
    function getAllowance(
        address token,
        address owner,
        address spender
    ) public view returns (uint256) {
        return _getAllowance(token, owner, spender);
    }

    ///@notice pull token if it is below the threshold of amount
    ///@dev _pullTokensIfNeeded(address token, address from, uint256 amount)
    ///@param token address of the token
    ///@param from address of the from
    ///@param amount address of the amount
    ///@return uint256 amount of the token that was pulled
    function pullTokensIfNeeded(
        address token,
        address from,
        uint256 amount
    ) public returns (uint256) {
        return _pullTokensIfNeeded(token, from, amount);
    }

    ///@notice withdraw the tokens from the vault and send them to the user
    ///@dev _withdrawTokens(address token, address to, uint256 amount)
    ///@param token address of the token
    ///@param to address of the user
    ///@param amount address of the balance
    function withdrawTokens(
        address token,
        address to,
        uint256 amount
    ) public {
        _withdrawTokens(token, to, amount);
    }
}
