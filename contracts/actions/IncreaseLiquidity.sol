// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '../helpers/ERC20Helper.sol';
import '../helpers/NFTHelper.sol';
import '../utils/Storage.sol';

interface IIncreaseLiquidity {
    function increaseLiquidity(
        uint256 tokenId,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) external;
}

///@notice action to increase the liquidity of a V3 position
contract IncreaseLiquidity {
    function increaseLiquidity(
        uint256 tokenId,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) public {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        require(
            amount0Desired > 0 || amount1Desired > 0,
            'IncreaseLiquidity::increaseLiquidity: Amounts cannot be both zero'
        );

        (address token0Address, address token1Address) = NFTHelper._getTokenAddress(
            tokenId,
            INonfungiblePositionManager(Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress())
        );

        ERC20Helper._approveToken(
            token0Address,
            Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress(),
            amount0Desired
        );
        ERC20Helper._approveToken(
            token1Address,
            Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress(),
            amount1Desired
        );

        /* IERC20 token0 = IERC20(token0Address);
        IERC20 token1 = IERC20(token1Address);

        //TODO: pulling from msg.sender is not how we want the code to work and returning tokens to msg.sender is not optimal.
        ERC20Helper._pullTokensIfNeeded(token0Address, msg.sender, amount0Desired);
        ERC20Helper._pullTokensIfNeeded(token1Address, msg.sender, amount1Desired); */

        INonfungiblePositionManager.IncreaseLiquidityParams memory params = INonfungiblePositionManager
            .IncreaseLiquidityParams({
                tokenId: tokenId,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 120
            });
        INonfungiblePositionManager(Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress()).increaseLiquidity(
                params
            );

        /* if (amount0 < amount0Desired) token0.transfer(Storage.owner, amount0Desired - amount0);
        if (amount1 < amount1Desired) token1.transfer(Storage.owner, amount1Desired - amount1); */
    }
}
