// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import '../../interfaces/IAToken.sol';
import '../../interfaces/ILendingPool.sol';
import '../../interfaces/IPositionManager.sol';
import '../../interfaces/actions/IAaveDeposit.sol';
import '../utils/Storage.sol';

///@notice action to deposit tokens into aave protocol
contract AaveDeposit is IAaveDeposit {
    using SafeERC20 for IERC20;

    ///@notice emitted when a deposit on aave is made
    ///@param positionManager address of aave positionManager which deposited
    ///@param token token address
    ///@param id aave position id
    ///@param shares shares emitted
    event DepositedOnAave(address indexed positionManager, address token, uint256 id, uint256 shares);

    ///@notice deposit to aave some token amount
    ///@param token token address
    ///@param amount amount to deposit
    ///@param tokenId tokenId of the position deposited to aave
    ///@return id of the deposited position
    ///@return shares emitted
    function depositToAave(
        address token,
        uint256 amount,
        uint256 tokenId
    ) external override returns (uint256 id, uint256 shares) {
        ILendingPool lendingPool = ILendingPool(
            PositionManagerStorage.getStorage().aaveAddressHolder.lendingPoolAddress()
        );

        IAToken aToken = IAToken(lendingPool.getReserveData(token).aTokenAddress);

        require(address(aToken) != address(0), 'AaveDeposit::depositToAave: Aave token not found.');

        uint256 balanceBefore = aToken.scaledBalanceOf(address(this));

        if (IERC20(token).allowance(address(this), address(lendingPool)) < amount)
            IERC20(token).safeIncreaseAllowance(address(lendingPool), type(uint256).max);

        lendingPool.deposit(token, amount, address(this), 0);

        shares = aToken.scaledBalanceOf(address(this)) - balanceBefore;

        id = _updateAavePosition(token, shares, tokenId);
        emit DepositedOnAave(address(this), token, id, shares);
    }

    ///@dev now dont use anymore aaveid since we have tokenId that is unique - store shares for tokenId and tokenToAave for tokenId
    ///@dev since they can't be duplicated. Store totalShares for tokenToAave since we keep track of the total amount of tokens in aave.
    function _updateAavePosition(
        address token,
        uint256 shares,
        uint256 tokenId
    ) internal returns (uint256) {
        PositionManagerStorage.addDynamicStorageKey(keccak256(abi.encodePacked(tokenId, 'aave_shares')));
        PositionManagerStorage.addDynamicStorageKey(keccak256(abi.encodePacked(token, 'aave_totalShares')));
        PositionManagerStorage.addDynamicStorageKey(keccak256(abi.encodePacked(tokenId, 'aave_tokenToAave')));

        uint256 oldShares = uint256(
            PositionManagerStorage.getDynamicStorageValue(keccak256(abi.encodePacked(tokenId, 'aave_shares')))
        );
        uint256 sharesEmitted = uint256(
            PositionManagerStorage.getDynamicStorageValue(keccak256(abi.encodePacked(token, 'aave_totalShares')))
        );

        require(oldShares == 0, 'AaveDeposit::_pushTokenIdToAave: positionShares does not exist');
        PositionManagerStorage.setDynamicStorageValue(
            keccak256(abi.encodePacked(tokenId, 'aave_tokenToAave')),
            bytes32(uint256(uint160(token)))
        );

        PositionManagerStorage.setDynamicStorageValue(
            keccak256(abi.encodePacked(tokenId, 'aave_shares')),
            bytes32(shares)
        );
        PositionManagerStorage.setDynamicStorageValue(
            keccak256(abi.encodePacked(token, 'aave_totalShares')),
            bytes32(sharesEmitted + shares)
        );

        return tokenId;
    }
}
