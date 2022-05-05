// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../../interfaces/IPositionManager.sol';
import '../../interfaces/IPositionManagerFactory.sol';
import '../helpers/SwapHelper.sol';
import '../helpers/UniswapNFTHelper.sol';
import '../helpers/ERC20Helper.sol';
import '../actions/ClosePosition.sol';
import '../actions/ZapOut.sol';

///@notice WithdrawRecipes allows user to withdraw positions from PositionManager
contract WithdrawRecipes {
    IPositionManagerFactory positionManagerFactory;

    constructor(address _positionManagerFactory) {
        positionManagerFactory = IPositionManagerFactory(_positionManagerFactory);
    }

    ///@notice remove uniswap position NFT to the position manager
    ///@param tokenIds IDs of deposited tokens
    function withdrawUniNft(uint256[] calldata tokenIds, bool returnTokenToUser) external {
        for (uint32 i = 0; i < tokenIds.length; i++) {
            IClosePosition(positionManagerFactory.userToPositionManager(msg.sender)).closePosition(
                tokenIds[i],
                returnTokenToUser
            );
        }
    }

    ///@notice remove a position from positionmanager zapping out
    ///@param tokenIds IDs of the tokens to withdraw
    ///@param tokenOut address of the token to withdraw
    function zapOutUniNft(uint256[] calldata tokenIds, address tokenOut) external {
        for (uint32 i = 0; i < tokenIds.length; i++) {
            IZapOut(positionManagerFactory.userToPositionManager(msg.sender)).zapOut(tokenIds[i], tokenOut);
        }
    }
}
