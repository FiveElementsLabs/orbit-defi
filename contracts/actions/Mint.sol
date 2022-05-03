// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '../helpers/ERC20Helper.sol';
import '../../interfaces/IPositionManager.sol';
import '../utils/Storage.sol';

interface IMint {
    ///@notice struct for input of the mint action
    ///@param token0Address address of the first token
    ///@param token1Address address of the second token
    ///@param fee pool fee level
    ///@param tickLower lower tick of the position
    ///@param tickUpper upper tick of the position
    ///@param amount0Desired amount of first token in position
    ///@param amount1Desired amount of second token in position
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
contract Mint is IMint {
    ///@notice emitted when a UniswapNFT is deposited in PositionManager
    ///@param positionManager address of PositionManager
    ///@param tokenId Id of deposited token
    event MintUniEvent(address indexed positionManager, uint256 tokenId);

    ///@notice mints a UniswapV3 position NFT
    ///@param inputs struct of MintInput parameters
    ///@return tokenId ID of the minted NFT
    ///@return amount0Deposited token0 amount deposited
    ///@return amount1Deposited token1 amount deposited
    function mint(MintInput calldata inputs)
        public
        override
        returns (
            uint256 tokenId,
            uint256 amount0Deposited,
            uint256 amount1Deposited
        )
    {
        StorageStruct storage Storage = PositionManagerStorage.getStorage();

        ERC20Helper._approveToken(
            inputs.token0Address,
            Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress(),
            inputs.amount0Desired
        );
        ERC20Helper._approveToken(
            inputs.token1Address,
            Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress(),
            inputs.amount1Desired
        );

        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
            token0: inputs.token0Address,
            token1: inputs.token1Address,
            fee: inputs.fee,
            tickLower: inputs.tickLower,
            tickUpper: inputs.tickUpper,
            amount0Desired: inputs.amount0Desired,
            amount1Desired: inputs.amount1Desired,
            amount0Min: 0,
            amount1Min: 0,
            recipient: address(this),
            deadline: block.timestamp + 120
        });

        (tokenId, , amount0Deposited, amount1Deposited) = INonfungiblePositionManager(
            Storage.uniswapAddressHolder.nonfungiblePositionManagerAddress()
        ).mint(params);

        IPositionManager(address(this)).pushPositionId(tokenId);
        emit MintUniEvent(address(this), tokenId);
    }
}
