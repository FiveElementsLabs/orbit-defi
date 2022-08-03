// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '../../interfaces/actions/IMint.sol';
import '../../interfaces/actions/IZapIn.sol';
import '../../interfaces/IPositionManager.sol';
import '../../interfaces/IPositionManagerFactory.sol';
import '../../interfaces/IUniswapAddressHolder.sol';

///@notice DepositRecipes allows user to fill their position manager with UniswapV3 positions
///        by depositing an already minted NFT or by minting directly a new one
contract DepositRecipes {
    using SafeERC20 for IERC20;

    IUniswapAddressHolder public immutable uniswapAddressHolder;
    IPositionManagerFactory public immutable positionManagerFactory;

    constructor(address _uniswapAddressHolder, address _positionManagerFactory) {
        uniswapAddressHolder = IUniswapAddressHolder(_uniswapAddressHolder);
        positionManagerFactory = IPositionManagerFactory(_positionManagerFactory);
    }

    ///@notice emitted when a position is created
    ///@param positionManager the address of the position manager which recieved the position
    ///@param from address of the user
    ///@param tokenId ID of the minted NFT
    event PositionDeposited(address indexed positionManager, address from, uint256 tokenId);

    ///@notice add uniswap position NFT to the position manager
    ///@param tokenIds IDs of deposited tokens
    function depositUniNft(uint256[] calldata tokenIds) external {
        address positionManagerAddress = positionManagerFactory.userToPositionManager(msg.sender);

        uint256 tokenIdsLength = tokenIds.length;
        for (uint256 i; i < tokenIdsLength; ++i) {
            INonfungiblePositionManager(uniswapAddressHolder.nonfungiblePositionManagerAddress()).safeTransferFrom(
                msg.sender,
                positionManagerAddress,
                tokenIds[i],
                '0x0'
            );
            IPositionManager(positionManagerAddress).middlewareUniswap(tokenIds[i], 0);
            emit PositionDeposited(positionManagerAddress, msg.sender, tokenIds[i]);
        }
    }

    ///@notice mint uniswapV3 NFT and deposit in the position manager
    ///@param token0 the first token to be deposited
    ///@param token1 the second token to be deposited
    ///@param fee fee tier of the pool to be deposited in
    ///@param tickLower the lower bound of the position range
    ///@param tickUpper the upper bound of the position range
    ///@param amount0Desired the amount of the first token to be deposited
    ///@param amount1Desired the amount of the second token to be deposited
    ///@return tokenId the ID of the minted NFT
    function mintAndDeposit(
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) external returns (uint256 tokenId) {
        address positionManager = positionManagerFactory.userToPositionManager(msg.sender);

        ///@dev send tokens to position manager to be able to call the mint action
        IERC20(token0).safeTransferFrom(msg.sender, positionManager, amount0Desired);
        IERC20(token1).safeTransferFrom(msg.sender, positionManager, amount1Desired);

        (tokenId, , ) = IMint(positionManager).mint(
            IMint.MintInput(token0, token1, fee, tickLower, tickUpper, amount0Desired, amount1Desired)
        );
        IPositionManager(positionManager).middlewareUniswap(tokenId, 0);
    }

    ///@notice mints a uni NFT with a single input token, tokens must be passed correctly ordered
    ///@param token0 address token0 of the pool
    ///@param token1 address token1 of the pool
    ///@param isToken0In true if the input token is token0, false if the input token is token1
    ///@param amountIn amount of input token
    ///@param tickLower lower bound of desired position
    ///@param tickUpper upper bound of desired position
    ///@param fee fee tier of the pool
    ///@return tokenId of minted NFT
    function zapInUniNft(
        address token0,
        address token1,
        bool isToken0In,
        uint256 amountIn,
        int24 tickLower,
        int24 tickUpper,
        uint24 fee
    ) external returns (uint256 tokenId) {
        address positionManager = positionManagerFactory.userToPositionManager(msg.sender);

        (tokenId) = IZapIn(positionManager).zapIn(token0, token1, isToken0In, amountIn, tickLower, tickUpper, fee);
        IPositionManager(positionManager).middlewareUniswap(tokenId, 0);
    }
}
