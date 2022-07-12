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

    function _updateAavePosition(
        address token,
        uint256 shares,
        uint256 tokenId
    ) internal returns (uint256) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        uint256 id = Storage.aaveIdCounter;
        require(
            Storage.aaveUserReserves[token].positionShares[id] == 0,
            'AaveDeposit::_pushTokenIdToAave: positionShares does not exist'
        );
        Storage.aavePositionsArray.push(AavePositions({id: id, tokenToAave: token}));

        Storage.aaveUserReserves[token].positionShares[id] = shares;
        Storage.aaveUserReserves[token].sharesEmitted += shares;
        Storage.aaveUserReserves[token].tokenIds[id] = tokenId;
        Storage.aaveIdCounter++;
        return id;
    }
}
