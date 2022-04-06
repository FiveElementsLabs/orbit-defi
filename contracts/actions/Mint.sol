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

///@notice action to mint a UniswapV3 position NFT
contract Mint {
    IUniswapAddressHolder public uniswapAddressHolder;

    ///@notice emitted when a UniswapNFT is deposited in PositionManager
    ///@param from address of PositionManager
    ///@param tokenId Id of deposited token
    event DepositUni(address indexed from, uint256 tokenId);

    ///@notice input the decoder expects
    ///@param token0Address address of first token of the pool
    ///@param token1Address address of second token of the pool
    ///@param fee fee tier of the pool
    ///@param tickLower lower tick of position
    ///@param tickUpper upper tick of position
    ///@param amount0Desired maximum token0 amount to be deposited
    ///@param amount1Desired maximum token1 amount to be deposited
    struct InputStruct {
        address token0Address;
        address token1Address;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
    }

    ///@notice output struct returned by the contract
    ///@param tokenId ID of the minted NFT
    ///@param amount0Deposited token0 amount deposited
    ///@param amount1Deposited token1 amount deposited
    struct OutputStruct {
        uint256 tokenId;
        uint256 amount0Deposited;
        uint256 amount1Deposited;
    }

    ///@notice executes the action of the contract (mint), should be the only function visible from the outside
    ///@param inputs input bytes to be decoded according to InputStruct
    ///@return outputs outputs encoded according OutputStruct
    function doAction(bytes memory inputs) public returns (OutputStruct memory outputs) {
        InputStruct memory inputsStruct = decodeInputs(inputs);
        outputs = mint(inputsStruct);
    }

    ///@notice mints a UniswapV3 position NFT
    ///@param inputs input parameters for minting
    ///@param outputs output parameters
    function mint(InputStruct memory inputs) internal returns (OutputStruct memory outputs) {
        address poolAddress = NFTHelper._getPoolAddress(
            uniswapAddressHolder.uniswapV3FactoryAddress(),
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
            uniswapAddressHolder.nonfungiblePositionManagerAddress(),
            2**256 - 1
        );
        ERC20Helper._approveToken(
            inputs.token1Address,
            uniswapAddressHolder.nonfungiblePositionManagerAddress(),
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
            deadline: block.timestamp + 1000 //TODO: decide uniform deadlines
        });

        (uint256 tokenId, , uint256 amount0Deposited, uint256 amount1Deposited) = INonfungiblePositionManager(
            uniswapAddressHolder.nonfungiblePositionManagerAddress()
        ).mint(params);

        //TODO: push TokenID to positon manager's positions list
        emit DepositUni(msg.sender, tokenId);

        outputs = OutputStruct({
            tokenId: tokenId,
            amount0Deposited: amount0Deposited,
            amount1Deposited: amount1Deposited
        });
    }

    ///@notice decodes inputs to InputStruct
    ///@param inputBytes input bytes to be decoded
    ///@return input decoded input struct
    function decodeInputs(bytes memory inputBytes) internal pure returns (InputStruct memory input) {
        (
            address token0Address,
            address token1Address,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint256 amount0Desired,
            uint256 amount1Desired
        ) = abi.decode(inputBytes, (address, address, uint24, int24, int24, uint256, uint256));
        input = InputStruct({
            token0Address: token0Address,
            token1Address: token1Address,
            fee: fee,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: amount0Desired,
            amount1Desired: amount1Desired
        });
    }
}
