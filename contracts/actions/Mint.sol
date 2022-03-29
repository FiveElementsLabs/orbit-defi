// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import './BaseAction.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';

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

    constructor(INonfungiblePositionManager _nonfungiblePositionManager) {
        nonfungiblePositionManager = _nonfungiblePositionManager;
    }

    function doAction(bytes memory inputs) public override returns (bytes memory) {
        InputStruct memory inputsStruct = decodeInputs(inputs);
        OutputStruct memory outputsStruct = mint(inputsStruct);
        return encodeOutputs(outputsStruct);
    }

    function mint(InputStruct memory inputs) internal returns (OutputStruct memory outputs) {
        //TODO: use swap helper to take the exact amounts to deposit

        IERC20 token0 = IERC20(inputs.token0Address);
        token0.approve(address(nonfungiblePositionManager), inputs.amount0Desired);
        IERC20 token1 = IERC20(inputs.token1Address);
        token1.approve(address(nonfungiblePositionManager), inputs.amount1Desired);

        (uint256 tokenId, , uint256 amount0Deposited, uint256 amount1Deposited) = nonfungiblePositionManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: inputs.token0Address,
                token1: inputs.token1Address,
                fee: inputs.fee,
                tickLower: inputs.tickLower,
                tickUpper: inputs.tickUpper,
                amount0Desired: inputs.amount0Desired,
                amount1Desired: inputs.amount1Desired,
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
}
