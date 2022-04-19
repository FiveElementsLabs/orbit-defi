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

///@notice DepositRecipes allows user to fill their position manager with UniswapV3 positions
///        by depositing an already minted NFT or by minting directly a new one
contract DepositRecipes {
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

    ///@notice emitted when a NFT is minted
    ///@param tokenId the id of the minted NFT
    event MintedNFT(uint256 tokenId);

    ///@notice emitted when a position is created
    ///@param from address of the user
    ///@param tokenId ID of the minted NFT
    event DepositUni(address indexed from, uint256 tokenId);

    ///@notice add uniswap position NFT to the position manager
    ///@param tokenIds IDs of deposited tokens
    function depositUniNft(uint256[] calldata tokenIds) external {
        for (uint32 i = 0; i < tokenIds.length; i++) {
            nonfungiblePositionManager.safeTransferFrom(
                msg.sender,
                positionManagerFactory.userToPositionManager(msg.sender),
                tokenIds[i],
                '0x0'
            );
            IPositionManager(positionManagerFactory.userToPositionManager(msg.sender)).pushPositionId(tokenIds[i]);
            emit DepositUni(msg.sender, tokenIds[i]);
        }
    }

    ///@notice mint uniswapV3 NFT and deposit in the position manager
    ///@param token0 the first token to be deposited
    ///@param token1 the second token to be deposited
    ///@param amount0 the amount of the first token to be deposited
    ///@param amount1 the amount of the second token to be deposited
    ///@param tickLower the lower bound of the position range
    ///@param tickUpper the upper bound of the position range
    ///@param fee fee tier of the pool to be deposited in
    ///@return tokenId the ID of the minted NFT
    function mintAndDeposit(
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1,
        int24 tickLower,
        int24 tickUpper,
        uint24 fee
    ) public returns (uint256 tokenId) {
        ERC20Helper._pullTokensIfNeeded(token0, msg.sender, amount0);
        ERC20Helper._pullTokensIfNeeded(token1, msg.sender, amount1);

        ERC20Helper._approveToken(token0, address(nonfungiblePositionManager), amount0);
        ERC20Helper._approveToken(token1, address(nonfungiblePositionManager), amount1);
        address positionManagerAddress = positionManagerFactory.userToPositionManager(msg.sender);
        (tokenId, , , ) = nonfungiblePositionManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: fee,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: 0,
                amount1Min: 0,
                recipient: positionManagerAddress,
                deadline: block.timestamp + 1
            })
        );
        IPositionManager(positionManagerAddress).pushPositionId(tokenId);
        emit MintedNFT(tokenId);
    }

    ///@notice mints a uni NFT with a single input token, the token in input can be different from the two position tokens
    ///@param tokenIn address of input token
    ///@param amountIn amount of input token
    ///@param token0 address token0 of the pool
    ///@param token1 address token1 of the pool
    ///@param tickLower lower bound of desired position
    ///@param tickUpper upper bound of desired position
    ///@param fee fee tier of the pool
    ///@return tokenId of minted NFT
    function zapIn(
        address tokenIn,
        uint256 amountIn,
        address token0,
        address token1,
        int24 tickLower,
        int24 tickUpper,
        uint24 fee
    ) public returns (uint256 tokenId) {
        require(token0 != token1, 'Zapper::zapIn: token0 and token1 cannot be the same');
        (token0, token1) = _reorderTokens(token0, token1);

        ERC20Helper._pullTokensIfNeeded(tokenIn, msg.sender, amountIn);

        (, int24 tickPool, , , , , ) = IUniswapV3Pool(
            UniswapNFTHelper._getPool(uniswapAddressHolder.uniswapV3FactoryAddress(), token0, token1, fee)
        ).slot0();
        uint256 ratioE18 = SwapHelper.getRatioFromRange(tickPool, tickLower, tickUpper);
        uint256 amountInTo0 = (amountIn * 1e18) / (ratioE18 + 1e18);
        uint256 amountInTo1 = amountIn - amountInTo0;

        ERC20Helper._approveToken(tokenIn, address(swapRouter), amountIn);
        //if token in input is not the token0 of the pool, we need to swap it
        if (tokenIn != token0) {
            amountInTo0 = swapRouter.exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: token0,
                    fee: fee,
                    recipient: address(this),
                    deadline: block.timestamp + 1,
                    amountIn: amountInTo0,
                    amountOutMinimum: 1,
                    sqrtPriceLimitX96: 0
                })
            );
        }

        //if token in input is not the token1 of the pool, we need to swap it
        if (tokenIn != token1) {
            ERC20Helper._approveToken(tokenIn, address(swapRouter), amountIn);
            amountInTo1 = swapRouter.exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: token1,
                    fee: fee,
                    recipient: address(this),
                    deadline: block.timestamp + 1,
                    amountIn: amountInTo1,
                    amountOutMinimum: 1,
                    sqrtPriceLimitX96: 0
                })
            );
        }

        tokenId = mintAndDeposit(token0, token1, amountInTo0, amountInTo1, tickLower, tickUpper, fee);
    }

    ///@notice orders token addresses
    ///@param token0 address of token0
    ///@param token1 address of token1
    ///@return address first token address
    ///@return address second token address
    function _reorderTokens(address token0, address token1) internal pure returns (address, address) {
        if (token0 > token1) {
            return (token1, token0);
        } else {
            return (token0, token1);
        }
    }
}
