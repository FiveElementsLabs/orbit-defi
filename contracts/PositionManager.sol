// SPDX-License-Identifier: Unlicense

pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '../interfaces/IVault.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@uniswap/v3-periphery/contracts/base/ERC721Permit.sol';
//import '@uniswap/v3-periphery/contracts/NonfungiblePositionManager.sol';
import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import 'hardhat/console.sol';

/**
 * @title   Position Manager
 * @notice  A vault that provides liquidity on Uniswap V3.
 * @notice  User can Deposit here its Uni-v3 position
 * @notice  If user does so, he is sure that idle liquidity will always be employed in protocols
 * @notice  User will pay fee to external keepers
 * @notice  vault works for multiple positions
 */

contract PositionManager is
    IVault,
    ERC721 //ERC721Receiver
{
    // Protocol fee to compensate keeper
    uint256 protocolfee = 1e6;
    // Array with list of UNI v3 positions
    uint256[] positionsArray;
    // NonFungiblePositionManager to use
    INonfungiblePositionManager public nonFungiblePositionManager;

    event DepositUni(address indexed from, uint256 tokenId);

    address public owner;

    //IERC20 public immutable Itoken0;
    //IERC20 public immutable Itoken1;

    /**
     * @dev After deploying, strategy needs to be set via `setStrategy()`
     */
    constructor(address userAddress, address nonFungiblePositionManagerAddress)
        ERC721('Uniswap V3 Positions NFT-V1', 'UNI-V3-POS')
    {
        owner = userAddress;
        nonFungiblePositionManager = INonfungiblePositionManager(nonFungiblePositionManagerAddress);
    }

    /* function approveNft (uint256 tokenId) external payable {
        approve(msg.sender, tokenId);  //msg.sender or contract(address) ?
    } */

    /**
     * @notice add uniswap position to the position manager
     */
    function depositUniNft(
        address from,
        uint256 tokenId //uint256 amount
    ) external override {
        console.log('FROM ', from);
        console.log('TOKENID ', tokenId);
        console.log('CONTRACT ADDRESS ', address(this));
        console.log('MSG SENDER BALANCE ', nonFungiblePositionManager.symbol());
        nonFungiblePositionManager.safeTransferFrom(from, address(this), tokenId);
        //import NFPM interface
        //"connect" interface using deployed NFPM address
        //NFPMInstance = NFPM(NFPMAddress <= input!)
        //NFPMInstance.safeTransferFrom(from, address(this), tokenId);
        //emit DepositUni(from, tokenId);
    }

    /* function _getAndIncrementNonce(uint256 tokenId) internal override returns (uint256) {
        return uint256(_positions[tokenId].nonce++);
    } */

    /* function mintUniswapNft(
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min,
        address recipient,
        uint256 deadline
    ) external {
        Itoken0.transferFrom(msg.sender, address(this), amount0Desired);
        Itoken1.transferFrom(msg.sender, address(this), amount1Desired);

        MintParams memory params = MintParams({
            token0: token0,
            token1: token1,
            fee: fee,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: amount0Desired,
            amount1Desired: amount1Desired,
            amount0Min: amount0Min,
            amount1Min: amount1Min,
            recipient: recipient,
            deadline: deadline
        });

        (uint256 tokenId, , , ) = this.mint(params);
        console.log('TOKENID: ', tokenId);

        address approved = this.getApproved(tokenId);
        console.log('APPROVED ADDR: ', approved);
        _approve(msg.sender, tokenId);
        address approved2 = this.getApproved(tokenId);
        console.log('APPROVED ADDR: ', approved2);

        address owner = ownerOf(tokenId);
        console.log('OWNER ADDR: ', owner);
        console.log('ADDRESS(THIS): ', address(this));
        console.log('MSG SENDER ADDRESS: ', msg.sender);
        this.safeTransferFrom(owner, address(this), tokenId);
        //emit DepositUni(from, tokenId);
    } */

    /**
     * @notice get balance token0 and token1 in a position
     */
    /* function getPositionBalance(uint256 tokenId) external view returns(uint128 tokensOwed0, uint128 tokensOwed1) {
        (,,,,,,,,,,tokensOwed0,tokensOwed1) = this.positions(tokenId);
    } */

    /* function getPositionFee(uint256 tokenId) external view returns(uint256 tokensOwed0, uint256 tokensOwed1) {
        (,,,,,,,,,,tokensOwed0,tokensOwed1) = this.positions(tokenId);

    } */

    /**
     * @notice close and burn uniswap position; tokenId need to be approved
     */
    /* function closeUniPosition(uint256 tokenId) external view {
        this.burn(tokenId);
    } */

    /* function collectPositionFee(uint256 tokenId) external view returns (uint256 amount0, uint256 amount1) {
        INonfungiblePositionManager.CollectParams memory params = 
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: owner,
                amount0Max: 0,
                amount1Max: 1
            });

        (amount0, amount1) = this.collect(params);
    } */

    /* function increasePositionLiquidity(
        uint256 tokenId, 
        uint256 amount0Desired, 
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min,
        uint256 deadline
        ) external payable returns (uint256 amount0Desired, uint256 amount1Desired) {
        INonfungiblePositionManager.IncreaseLiquidityParams memory params =
            INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: tokenId,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: amount0Min,
                amount1Min: amount1Min,
                deadline: deadline
            });
        this.increaseLiquidity(params);
    } */

    modifier onlyUser() {
        require(msg.sender == owner, 'Only owner can call this function');
        _;
    }
}
//NonfungiblePositionManager.Position memory position = _positions[tokenId];
