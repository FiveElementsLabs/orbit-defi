// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import './BaseAction.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '../helpers/ERC20Helper.sol';

//these contracts should be imported from helpers
import '@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol';
import '@uniswap/v3-periphery/contracts/libraries/PositionKey.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';

///@notice action to mint a UniswapV3 position NFT
contract Mint is BaseAction {
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

    ///@notice output the encoder produces
    ///@param tokenId ID of the minted NFT
    ///@param amount0Deposited token0 amount deposited
    ///@param amount1Deposited token1 amount deposited
    struct OutputStruct {
        uint256 tokenId;
        uint256 amount0Deposited;
        uint256 amount1Deposited;
    }

    //TODO: these should be in a helper
    INonfungiblePositionManager public immutable nonfungiblePositionManager;
    IUniswapV3Factory public immutable factory;

    constructor(INonfungiblePositionManager _nonfungiblePositionManager, IUniswapV3Factory _uniV3Factory) {
        nonfungiblePositionManager = _nonfungiblePositionManager;
        factory = _uniV3Factory;
    }

    ///@notice executes the action of the contract (mint), should be the only function visible from the outside
    ///@param inputs input bytes to be decoded according to InputStruct
    ///@return bytes outputs encoded according OutputStruct
    function doAction(bytes memory inputs) public override returns (bytes memory) {
        InputStruct memory inputsStruct = decodeInputs(inputs);
        OutputStruct memory outputsStruct = mint(inputsStruct);
        return encodeOutputs(outputsStruct);
    }

    ///@notice mints a UniswapV3 position NFT
    ///@param inputs input parameters for minting
    ///@param outputs output parameters
    function mint(InputStruct memory inputs) internal returns (OutputStruct memory outputs) {
        // TODO: use helper to get pool price
        (uint160 sqrtPriceX96, , , , , , ) = getPool(inputs.token0Address, inputs.token1Address, inputs.fee).slot0();

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            TickMath.getSqrtRatioAtTick(inputs.tickLower),
            TickMath.getSqrtRatioAtTick(inputs.tickUpper),
            inputs.amount0Desired,
            inputs.amount1Desired
        );

        (uint256 amount0, uint256 amount1) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtPriceX96,
            TickMath.getSqrtRatioAtTick(inputs.tickLower),
            TickMath.getSqrtRatioAtTick(inputs.tickUpper),
            liquidity
        );

        ERC20Helper._approveToken(inputs.token0Address, address(nonfungiblePositionManager), amount0);
        ERC20Helper._approveToken(inputs.token1Address, address(nonfungiblePositionManager), amount1);

        (uint256 tokenId, , uint256 amount0Deposited, uint256 amount1Deposited) = nonfungiblePositionManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: inputs.token0Address,
                token1: inputs.token1Address,
                fee: inputs.fee,
                tickLower: inputs.tickLower,
                tickUpper: inputs.tickUpper,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: 0,
                amount1Min: 0,
                recipient: msg.sender,
                deadline: block.timestamp + 1000 //TODO: decide uniform deadlines
            })
        );

        //TODO: push TokenID to positon manager's positions list

        outputs = OutputStruct({
            tokenId: tokenId,
            amount0Deposited: amount0Deposited,
            amount1Deposited: amount1Deposited
        });

        emit DepositUni(msg.sender, tokenId);
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

    ///@notice encode the outputs to bytes
    ///@param outputs outputs to be encoded
    ///@return outputBytes encoded outputs
    function encodeOutputs(OutputStruct memory outputs) internal pure returns (bytes memory outputBytes) {
        outputBytes = abi.encode(outputs);
    }

    //TODO: when we have a helper, this function should be removed
    function getPool(
        address token0,
        address token1,
        uint24 fee
    ) public view returns (IUniswapV3Pool) {
        PoolAddress.PoolKey memory key = PoolAddress.getPoolKey(token0, token1, fee);

        address poolAddress = PoolAddress.computeAddress(address(factory), key);

        return IUniswapV3Pool(poolAddress);
    }
}
