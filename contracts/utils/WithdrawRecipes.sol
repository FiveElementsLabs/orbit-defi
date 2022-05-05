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
    IUniswapAddressHolder public uniswapAddressHolder;
    ISwapRouter swapRouter;
    INonfungiblePositionManager nonfungiblePositionManager;
    IPositionManagerFactory positionManagerFactory;

    constructor(address _uniswapAddressHolder, address _positionManagerFactory) {
        uniswapAddressHolder = IUniswapAddressHolder(_uniswapAddressHolder);
        swapRouter = ISwapRouter(uniswapAddressHolder.swapRouterAddress());
        nonfungiblePositionManager = INonfungiblePositionManager(
            uniswapAddressHolder.nonfungiblePositionManagerAddress()
        );
        positionManagerFactory = IPositionManagerFactory(_positionManagerFactory);
    }

    ///@notice emitted when a position is withdrawn
    ///@param positionManager the address of the position manager which has the position
    ///@param to address of the user
    ///@param tokenId ID of NFT
    event PositionWithdrawn(address indexed positionManager, address to, uint256 tokenId);

    ///@notice emitted when a position is withdrawn
    ///@param positionManager the address of the position manager which has the position
    ///@param to address of the user
    ///@param tokenId ID of NFT
    event ZapOut(address indexed positionManager, address to, uint256 tokenId);

    ///@notice remove uniswap position NFT to the position manager
    ///@param tokenIds IDs of deposited tokens
    function withdrawUniNft(uint256[] calldata tokenIds, bool returnTokenToUser) external {
        for (uint32 i = 0; i < tokenIds.length; i++) {
            IClosePosition(positionManagerFactory.userToPositionManager(msg.sender)).closePosition(
                tokenIds[i],
                returnTokenToUser
            );

            emit PositionWithdrawn(positionManagerFactory.userToPositionManager(msg.sender), msg.sender, tokenIds[i]);
        }
    }

    ///@notice remove a position from positionmanager zapping out
    ///@param tokenIds IDs of the tokens to withdraw
    ///@param tokenOut address of the token to withdraw

    function zapOutUniNft(uint256[] calldata tokenIds, address tokenOut) external {
        for (uint32 i = 0; i < tokenIds.length; i++) {
            IZapOut(positionManagerFactory.userToPositionManager(msg.sender)).zapOut(tokenIds[i], tokenOut);

            emit ZapOut(positionManagerFactory.userToPositionManager(msg.sender), msg.sender, tokenIds[i]);
        }
    }
}
