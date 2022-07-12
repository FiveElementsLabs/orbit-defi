// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '../helpers/UniswapNFTHelper.sol';
import '../helpers/SwapHelper.sol';
import '../helpers/ERC20Helper.sol';
import '../utils/Storage.sol';
import '../../interfaces/IPositionManager.sol';
import '../../interfaces/actions/IZapIn.sol';

contract ZapIn is IZapIn {
    using SafeMath for uint256;

    ///@notice emitted when a UniswapNFT is zapped in
    ///@param positionManager address of PositionManager
    ///@param tokenId Id of zapped token
    ///@param tokenIn address of token zapped in
    ///@param amountIn amount of tokenIn zapped in
    event ZappedIn(address indexed positionManager, uint256 tokenId, address tokenIn, uint256 amountIn);

    ///@notice mints a uni NFT with a single input token, the token in input must be one of the two token in the pool
    ///@param token0 address token0 of the pool
    ///@param token1 address token1 of the pool
    ///@param isToken0In true if token0 is the input token, false if token1 is the input token
    ///@param amountIn amount of input token
    ///@param tickLower lower bound of desired position
    ///@param tickUpper upper bound of desired position
    ///@param fee fee tier of the pool
    ///@return tokenId of minted NFT
    function zapIn(
        address token0,
        address token1,
        bool isToken0In,
        uint256 amountIn,
        int24 tickLower,
        int24 tickUpper,
        uint24 fee
    ) external override returns (uint256 tokenId) {
        require(token0 != token1, 'ZapIn::zapIn: token0 and token1 cannot be the same');
        require(amountIn != 0, 'ZapIn::zapIn: tokenIn cannot be 0');

        (token0, token1, isToken0In) = _reorderTokens(token0, token1, isToken0In);

        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        ERC20Helper._pullTokensIfNeeded(isToken0In ? token0 : token1, Storage.owner, amountIn);
        ERC20Helper._approveToken(
            isToken0In ? token0 : token1,
            Storage.uniswapAddressHolder.swapRouterAddress(),
            amountIn
        );

        SwapHelper.checkDeviation(
            IUniswapV3Pool(
                UniswapNFTHelper._getPool(Storage.uniswapAddressHolder.uniswapV3FactoryAddress(), token0, token1, fee)
            ),
            Storage.registry.maxTwapDeviation(),
            Storage.registry.twapDuration()
        );

        (uint256 amountToSwap, ) = SwapHelper.calcAmountToSwap(
            _getPoolTick(token0, token1, fee),
            tickLower,
            tickUpper,
            isToken0In ? amountIn : 0,
            isToken0In ? 0 : amountIn
        );

        if (amountToSwap != 0) {
            ISwapRouter(Storage.uniswapAddressHolder.swapRouterAddress()).exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: isToken0In ? token0 : token1,
                    tokenOut: isToken0In ? token1 : token0,
                    fee: fee,
                    recipient: address(this),
                    deadline: block.timestamp,
                    amountIn: amountToSwap,
                    amountOutMinimum: 1,
                    sqrtPriceLimitX96: 0
                })
            );
        }

        (tokenId, , ) = _mint(
            token0,
            token1,
            fee,
            tickLower,
            tickUpper,
            IERC20(token0).balanceOf(address(this)),
            IERC20(token1).balanceOf(address(this))
        );

        emit ZappedIn(address(this), tokenId, isToken0In ? token0 : token1, amountIn);
    }

    ///@notice mints a UniswapV3 position NFT
    ///@param token0Address address of the first token
    ///@param token1Address address of the second token
    ///@param fee pool fee level
    ///@param tickLower lower tick of the position
    ///@param tickUpper upper tick of the position
    ///@param amount0Desired amount of first token in position
    ///@param amount1Desired amount of second token in position
    function _mint(
        address token0Address,
        address token1Address,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired
    )
        internal
        returns (
            uint256 tokenId,
            uint256 amount0Deposited,
            uint256 amount1Deposited
        )
    {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        address nonfungiblePositionManagerAddress = Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress();

        ERC20Helper._approveToken(token0Address, nonfungiblePositionManagerAddress, amount0Desired);
        ERC20Helper._approveToken(token1Address, nonfungiblePositionManagerAddress, amount1Desired);

        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
            token0: token0Address,
            token1: token1Address,
            fee: fee,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: amount0Desired,
            amount1Desired: amount1Desired,
            amount0Min: 0,
            amount1Min: 0,
            recipient: address(this),
            deadline: block.timestamp + 120
        });

        (tokenId, , amount0Deposited, amount1Deposited) = INonfungiblePositionManager(nonfungiblePositionManagerAddress)
            .mint(params);

        IPositionManager(address(this)).middlewareDeposit(tokenId);
    }

    ///@notice orders token addresses
    ///@param token0 address of token0
    ///@param token1 address of token1
    ///@param isToken0In true if token0 is the input token
    ///@return address first token address
    ///@return address second token address
    ///@return bool new token0 is the input token
    function _reorderTokens(
        address token0,
        address token1,
        bool isToken0In
    )
        internal
        pure
        returns (
            address,
            address,
            bool
        )
    {
        if (token0 > token1) {
            return (token1, token0, !isToken0In);
        } else {
            return (token0, token1, isToken0In);
        }
    }

    function _getPoolTick(
        address token0,
        address token1,
        uint24 fee
    ) internal view returns (int24 tick) {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();
        (, tick, , , , , ) = IUniswapV3Pool(
            UniswapNFTHelper._getPool(Storage.uniswapAddressHolder.uniswapV3FactoryAddress(), token0, token1, fee)
        ).slot0();
    }
}
