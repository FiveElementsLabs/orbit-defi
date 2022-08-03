// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '../helpers/UniswapNFTHelper.sol';
import '../helpers/ERC20Helper.sol';
import '../../interfaces/IPositionManager.sol';
import '../../interfaces/IPositionManagerFactory.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../../interfaces/actions/IAaveWithdraw.sol';
import '../../interfaces/actions/ICollectFees.sol';
import '../../interfaces/actions/IClosePosition.sol';
import '../../interfaces/actions/IDecreaseLiquidity.sol';
import '../../interfaces/actions/IZapOut.sol';
import '../../interfaces/actions/ISwap.sol';

///@notice WithdrawRecipes allows user to withdraw positions from PositionManager
contract WithdrawRecipes {
    using SafeMath for uint256;

    IPositionManagerFactory public immutable positionManagerFactory;
    IUniswapAddressHolder public immutable uniswapAddressHolder;

    uint256 constant MAX_WITHDRAW_AMOUNT = 10_000;

    modifier onlyOwner(uint256 tokenId) {
        require(
            positionManagerFactory.userToPositionManager(msg.sender) ==
                INonfungiblePositionManager(uniswapAddressHolder.nonfungiblePositionManagerAddress()).ownerOf(tokenId),
            'WithdrawRecipes::onlyOwner: Only owner can call this function'
        );
        _;
    }

    constructor(address _positionManagerFactory, address _uniswapAddressHolder) {
        positionManagerFactory = IPositionManagerFactory(_positionManagerFactory);
        uniswapAddressHolder = IUniswapAddressHolder(_uniswapAddressHolder);
    }

    ///@notice remove uniswap position NFT to the position manager
    ///@param tokenId ID of deposited token
    ///@param partToWithdraw percentage of token to withdraw in base points
    function withdrawUniNft(uint256 tokenId, uint256 partToWithdraw) external onlyOwner(tokenId) {
        require(partToWithdraw != 0 && partToWithdraw <= MAX_WITHDRAW_AMOUNT, 'WRP');
        address positionManager = positionManagerFactory.userToPositionManager(msg.sender);

        if (partToWithdraw == MAX_WITHDRAW_AMOUNT) {
            IClosePosition(positionManager).closePosition(
                tokenId,
                true ///@dev return the tokens to the user
            );
            IPositionManager(positionManager).middlewareUniswap(0, tokenId);
        } else {
            // 1. get position size
            // 2. divide for part to withdraw
            (uint256 amount0, uint256 amount1) = UniswapNFTHelper._getAmountsfromTokenId(
                tokenId,
                INonfungiblePositionManager(uniswapAddressHolder.nonfungiblePositionManagerAddress()),
                uniswapAddressHolder.uniswapV3FactoryAddress()
            );

            IDecreaseLiquidity(positionManager).decreaseLiquidity(
                tokenId,
                (amount0.mul(partToWithdraw)).div(MAX_WITHDRAW_AMOUNT),
                (amount1.mul(partToWithdraw)).div(MAX_WITHDRAW_AMOUNT)
            );
            ICollectFees(positionManager).collectFees(tokenId, true);
        }
    }

    ///@notice remove a position from positionmanager zapping out
    ///@param tokenId ID of the NFT to zap out
    ///@param tokenOut address of the token to withdraw
    ///@return amountWithdrawn amount of tokens withdrawn
    function zapOutUniNft(uint256 tokenId, address tokenOut)
        external
        onlyOwner(tokenId)
        returns (uint256 amountWithdrawn)
    {
        address positionManager = positionManagerFactory.userToPositionManager(msg.sender);
        amountWithdrawn = IZapOut(positionManager).zapOut(tokenId, tokenOut);
        IPositionManager(positionManager).middlewareUniswap(0, tokenId);
    }

    ///@notice withdraw a position currently on Aave
    ///@param tokenId identifier of the aave position to withdraw
    ///@param partToWithdraw percentage of position withdraw in base points
    ///@return amountWithdrawn amount of token withdrawn
    function withdrawFromAave(uint256 tokenId, uint256 partToWithdraw)
        external
        onlyOwner(tokenId)
        returns (uint256 amountWithdrawn)
    {
        require(partToWithdraw != 0 && partToWithdraw <= MAX_WITHDRAW_AMOUNT, 'WRA');

        address positionManager = positionManagerFactory.userToPositionManager(msg.sender);

        if (partToWithdraw == MAX_WITHDRAW_AMOUNT) {
            IClosePosition(positionManager).closePosition(tokenId, true);
            IPositionManager(positionManager).middlewareUniswap(0, tokenId);
        }

        (, address tokenToAave) = IPositionManager(positionManager).getAaveDataFromTokenId(tokenId);

        amountWithdrawn = IAaveWithdraw(positionManager).withdrawFromAave(tokenToAave, tokenId, partToWithdraw, true);
    }

    ///@notice withdraw a position currently on Aave and swap everything to the other token of the pool
    ///@param tokenId identifier of the aave position to withdraw
    ///@param tokenOut address of the token to withdraw
    ///@return amountWithdrawn amount of token withdrawn
    function zapOutFromAave(uint256 tokenId, address tokenOut)
        external
        onlyOwner(tokenId)
        returns (uint256 amountWithdrawn)
    {
        address positionManager = positionManagerFactory.userToPositionManager(msg.sender);
        (, address tokenToAave) = IPositionManager(positionManager).getAaveDataFromTokenId(tokenId);

        if (tokenToAave != tokenOut) {
            (, , uint24 fee, , ) = UniswapNFTHelper._getTokens(
                tokenId,
                INonfungiblePositionManager(uniswapAddressHolder.nonfungiblePositionManagerAddress())
            );

            amountWithdrawn = IAaveWithdraw(positionManager).withdrawFromAave(
                tokenToAave,
                tokenId,
                MAX_WITHDRAW_AMOUNT,
                false ///@dev don't return the tokens to the user here because we need to swap them first
            );

            ISwap(positionManager).swap(tokenToAave, tokenOut, fee, amountWithdrawn, true);
        } else {
            amountWithdrawn = IAaveWithdraw(positionManager).withdrawFromAave(
                tokenToAave,
                tokenId,
                MAX_WITHDRAW_AMOUNT,
                true
            );
        }

        IClosePosition(positionManager).closePosition(tokenId, true);
        IPositionManager(positionManager).middlewareUniswap(0, tokenId);
    }
}
