// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '../helpers/ERC20Helper.sol';
import '../helpers/NFTHelper.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../../interfaces/IPositionManager.sol';
import '../utils/Storage.sol';

interface IMint {
    struct MintInput {
        address token0Address;
        address token1Address;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
    }

    function mint(MintInput calldata inputs)
        external
        returns (
            uint256 tokenId,
            uint256 amount0Deposited,
            uint256 amount1Deposited
        );
}

///@notice action to mint a UniswapV3 position NFT
contract Mint {
    ///@notice emitted when a UniswapNFT is deposited in PositionManager
    ///@param from address of PositionManager
    ///@param tokenId Id of deposited token
    event DepositUni(address indexed from, uint256 tokenId);

    struct MintInput {
        address token0Address;
        address token1Address;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
    }

    ///@notice mints a UniswapV3 position NFT
    ///@param inputs struct of MintInput parameters
    ///@return tokenId ID of the minted NFT
    ///@return amount0Deposited token0 amount deposited
    ///@return amount1Deposited token1 amount deposited
    function mint(MintInput calldata inputs)
        public
        returns (
            uint256 tokenId,
            uint256 amount0Deposited,
            uint256 amount1Deposited
        )
    {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        address poolAddress = NFTHelper._getPoolAddress(
            Storage.uniswapAddressHolder.uniswapV3FactoryAddress(),
            inputs.token0Address,
            inputs.token1Address,
            inputs.fee
        );

        uint128 liquidity = NFTHelper._getLiquidityFromAmount(
            inputs.amount0Desired,
            inputs.amount1Desired,
            inputs.tickLower,
            inputs.tickUpper,
            poolAddress
        );

        (uint256 amount0, uint256 amount1) = NFTHelper._getAmountFromLiquidity(
            liquidity,
            inputs.tickLower,
            inputs.tickUpper,
            poolAddress
        );

        ERC20Helper._approveToken(
            inputs.token0Address,
            Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress(),
            2**256 - 1
        );
        ERC20Helper._approveToken(
            inputs.token1Address,
            Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress(),
            2**256 - 1
        );

        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
            token0: inputs.token0Address,
            token1: inputs.token1Address,
            fee: inputs.fee,
            tickLower: inputs.tickLower,
            tickUpper: inputs.tickUpper,
            amount0Desired: amount0,
            amount1Desired: amount1,
            amount0Min: 0,
            amount1Min: 0,
            recipient: address(this),
            deadline: block.timestamp + 120
        });

        (tokenId, , amount0Deposited, amount1Deposited) = INonfungiblePositionManager(
            Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress()
        ).mint(params);

        IPositionManager(address(this)).pushPositionId(tokenId);
        emit DepositUni(msg.sender, tokenId);
    }
}
