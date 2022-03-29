// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import './BaseAction.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';

//these contracts should be imported from helpers
import '@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol';
import '@uniswap/v3-periphery/contracts/libraries/PositionKey.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';

contract Mint is BaseAction {
    event DepositUni(address indexed from, uint256 tokenId);

    struct InputStruct {
        address token0Address;
        address token1Address;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
    }

    struct OutputStruct {
        uint256 tokenId;
        uint256 amount0Deposited;
        uint256 amount1Deposited;
    }

    INonfungiblePositionManager public immutable nonfungiblePositionManager;
    IUniswapV3Factory public immutable factory;

    constructor(INonfungiblePositionManager _nonfungiblePositionManager, IUniswapV3Factory _uniV3Factory) {
        nonfungiblePositionManager = _nonfungiblePositionManager;
        factory = _uniV3Factory;
    }

    function doAction(bytes memory inputs) public override returns (bytes memory) {
        InputStruct memory inputsStruct = decodeInputs(inputs);
        OutputStruct memory outputsStruct = mint(inputsStruct);
        return encodeOutputs(outputsStruct);
    }

    function mint(InputStruct memory inputs) internal returns (OutputStruct memory outputs) {
        // TODO: use helper to get pool price
        (, int24 tickPool, , , , , ) = getPool(inputs.token0Address, inputs.token1Address, inputs.fee).slot0();

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            TickMath.getSqrtRatioAtTick(tickPool),
            TickMath.getSqrtRatioAtTick(inputs.tickLower),
            TickMath.getSqrtRatioAtTick(inputs.tickUpper),
            inputs.amount0Desired,
            inputs.amount1Desired
        );

        (uint256 amount0, uint256 amount1) = LiquidityAmounts.getAmountsForLiquidity(
            TickMath.getSqrtRatioAtTick(tickPool),
            TickMath.getSqrtRatioAtTick(inputs.tickLower),
            TickMath.getSqrtRatioAtTick(inputs.tickUpper),
            liquidity
        );

        IERC20 token0 = IERC20(inputs.token0Address);
        token0.approve(address(nonfungiblePositionManager), amount0);
        IERC20 token1 = IERC20(inputs.token1Address);
        token1.approve(address(nonfungiblePositionManager), amount1);

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

    function encodeOutputs(OutputStruct memory outputs) internal pure returns (bytes memory outputBytes) {
        outputBytes = abi.encode(outputs);
    }

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
