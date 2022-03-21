// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC721/ERC721Holder.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol';
import '@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol';
import 'hardhat/console.sol';
import '../interfaces/IVault.sol';
import '@uniswap/v3-periphery/contracts/libraries/PositionKey.sol';
import '@uniswap/v3-periphery/contracts/libraries/PositionValue.sol';

/**
 * @title   Position Manager
 * @notice  A vault that provides liquidity on Uniswap V3.
 * @notice  User can Deposit here its Uni-v3 position
 * @notice  If user does so, he is sure that idle liquidity will always be employed in protocols
 * @notice  User will pay fee to external keepers
 * @notice  vault works for multiple positions
 */

contract PositionManager is IVault, ERC721Holder {
    event DepositUni(address indexed from, uint256 tokenId);
    event WithdrawUni(address to, uint256 tokenId);

    address public immutable owner;
    address public immutable gov;
    uint256[] private uniswapNFTs;
    INonfungiblePositionManager public immutable nonfungiblePositionManager;
    IUniswapV3Factory public immutable factory;

    struct Module {
        address moduleAddress;
        bool    activated;
    }

    // details about the uniswap position
    struct Position {
        // the nonce for permits
        uint96 nonce;
        // the address that is approved for spending this token
        address operator;
        // the ID of the pool with which this token is connected
        uint80 poolId;
        // the tick range of the position
        int24 tickLower;
        int24 tickUpper;
        // the liquidity of the position
        uint128 liquidity;
        // the fee growth of the aggregate position as of the last action on the individual position
        uint256 feeGrowthInside0LastX128;
        uint256 feeGrowthInside1LastX128;
        // how many uncollected tokens are owed to the position, as of the last computation
        uint128 tokensOwed0;
        uint128 tokensOwed1;
    }

    constructor(address userAddress, INonfungiblePositionManager _nonfungiblePositionManager) {
        owner = userAddress;
        nonfungiblePositionManager = _nonfungiblePositionManager;
        factory = IUniswapV3Factory(_nonfungiblePositionManager.factory());
        gov = msg.sender;
    }

    /**
     * @notice add uniswap position NFT to the position manager
     */
    function depositUniNft(address from, uint256[] calldata tokenIds) external override onlyOwner {
        for (uint32 i = 0; i < tokenIds.length; i++) {
            nonfungiblePositionManager.safeTransferFrom(from, address(this), tokenIds[i], '0x0');
            uniswapNFTs.push(tokenIds[i]);
            emit DepositUni(from, tokenIds[i]);
        }
    }

    /**
     * @notice withdraw uniswap position NFT from the position manager
     */
    function withdrawUniNft(address to, uint256 tokenId) public onlyOwner {
        uint256 index = uniswapNFTs.length;
        for (uint256 i = 0; i < uniswapNFTs.length; i++) {
            if (uniswapNFTs[i] == tokenId) {
                index = i;
                i = uniswapNFTs.length;
            }
        }
        require(index < uniswapNFTs.length, 'token id not found!');
        nonfungiblePositionManager.safeTransferFrom(address(this), to, tokenId, '0x0');
        removeNFTFromList(index);
        emit WithdrawUni(to, tokenId);
    }

    //remove awareness of nft at index index
    function removeNFTFromList(uint256 index) internal {
        uniswapNFTs[index] = uniswapNFTs[uniswapNFTs.length - 1];
        uniswapNFTs.pop();
    }

    //wrapper for withdraw of all univ3positions in manager
    function withdrawAllUniNft(address to) external override onlyOwner {
        require(uniswapNFTs.length > 0, 'no NFT to withdraw');
        while (uniswapNFTs.length > 0) {
            withdrawUniNft(to, uniswapNFTs[0]);
        }
    }

    /**
     * @notice mint a univ3 position and deposit in manager
     */
    function mintAndDeposit(
        INonfungiblePositionManager.MintParams[] memory mintParams,
        bool _usingPositionManagerBalance
    ) public onlyOwner {
        //TODO: can be optimized by calculating amount that will be deposited before transferring them to positionManager
        //require(amount0Desired > 0 || amount1Desired > 0, 'can mint only nonzero amount');
        for (uint256 i = 0; i < mintParams.length; i++) {
            IERC20 token0 = IERC20(mintParams[i].token0);
            IERC20 token1 = IERC20(mintParams[i].token1);
            if (!_usingPositionManagerBalance) {
                token0.transferFrom(msg.sender, address(this), mintParams[i].amount0Desired);
                token1.transferFrom(msg.sender, address(this), mintParams[i].amount1Desired);
            }

            //approving token deposited to be utilized by nonFungiblePositionManager
            _approveToken(token0);
            _approveToken(token1);

            (uint256 tokenId, , uint256 amount0Deposited, uint256 amount1Deposited) = nonfungiblePositionManager.mint(
                mintParams[i]
            );

            uniswapNFTs.push(tokenId);
            emit DepositUni(msg.sender, tokenId);

            if (mintParams[i].amount0Desired > amount0Deposited && !_usingPositionManagerBalance) {
                token0.transfer(msg.sender, mintParams[i].amount0Desired - amount0Deposited);
            }
            if (mintParams[i].amount1Desired > amount1Deposited && !_usingPositionManagerBalance) {
                token1.transfer(msg.sender, mintParams[i].amount1Desired - amount1Deposited);
            }
        }
    }

    /**
     * @notice get balance token0 and token1 in a position
     */
    function getPositionBalance(uint256 tokenId) external view override returns (uint256, uint256) {
        (, , , , , int24 tickLower, int24 tickUpper, uint128 liquidity, , , , ) = nonfungiblePositionManager.positions(
            tokenId
        );

        IUniswapV3Pool pool = getPoolFromTokenId(tokenId);

        (uint160 sqrtRatioX96, , , , , , ) = pool.slot0();
        return
            LiquidityAmounts.getAmountsForLiquidity(
                sqrtRatioX96,
                TickMath.getSqrtRatioAtTick(tickLower),
                TickMath.getSqrtRatioAtTick(tickUpper),
                liquidity
            );
    }

    /**
     * @notice get fee of token0 and token1 in a position
     */
    function getPositionFee(uint256 tokenId) external view override returns (uint128 tokensOwed0, uint128 tokensOwed1) {
        (, , , , , , , , , , tokensOwed0, tokensOwed1) = nonfungiblePositionManager.positions(tokenId);
    }

    /**
     * @notice close and burn uniswap position; liquidity must be 0,
     */
    function closeUniPositions(uint256[] memory tokenIds, bool returnTokensToUser) external payable override onlyOwner {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            (, , , , , , , uint128 liquidity, , , , ) = nonfungiblePositionManager.positions(tokenIds[i]);

            INonfungiblePositionManager.DecreaseLiquidityParams
                memory decreaseliquidityparams = INonfungiblePositionManager.DecreaseLiquidityParams({
                    tokenId: tokenIds[i],
                    liquidity: liquidity,
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp + 1000
                });
            nonfungiblePositionManager.decreaseLiquidity(decreaseliquidityparams);

            INonfungiblePositionManager.CollectParams memory collectparams = INonfungiblePositionManager.CollectParams({
                tokenId: tokenIds[i],
                recipient: returnTokensToUser ? owner : address(this),
                amount0Max: 2**128 - 1,
                amount1Max: 2**128 - 1
            });
            nonfungiblePositionManager.collect(collectparams);

            nonfungiblePositionManager.burn(tokenIds[i]);

            //delete NFT burned from list
            for (uint32 j = 0; j < uniswapNFTs.length; j++) {
                if (uniswapNFTs[j] == tokenIds[i]) {
                    removeNFTFromList(j);
                }
            }
        }
    }

    /**
     * @notice for fees to be updated need to interact with NFT
     * not public!
     */
    function updateUncollectedFees(uint256 tokenId) public {
        INonfungiblePositionManager.DecreaseLiquidityParams memory params = INonfungiblePositionManager
            .DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: 1,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 1000
            });
        nonfungiblePositionManager.decreaseLiquidity(params);
    }

    function collectPositionFee(uint256 tokenId, address recipient)
        external
        override
        returns (uint256 amount0, uint256 amount1)
    {
        updateUncollectedFees(tokenId);
        (, , , , , , , , , , uint128 feesToken0, uint128 feesToken1) = nonfungiblePositionManager.positions(tokenId);
        INonfungiblePositionManager.CollectParams memory params = INonfungiblePositionManager.CollectParams({
            tokenId: tokenId,
            recipient: recipient,
            amount0Max: feesToken0,
            amount1Max: feesToken1
        });

        (amount0, amount1) = nonfungiblePositionManager.collect(params);
    }

    function increasePositionLiquidity(
        uint256 tokenId,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) external payable override returns (uint256 amount0, uint256 amount1) {
        require(amount0Desired > 0 || amount1Desired > 0, 'send some token to increase liquidity');

        (IERC20 token0, IERC20 token1) = _getTokenAddress(tokenId);

        _approveToken(token0);
        _approveToken(token1);

        token0.transferFrom(msg.sender, address(this), amount0Desired);
        token1.transferFrom(msg.sender, address(this), amount1Desired);

        INonfungiblePositionManager.IncreaseLiquidityParams memory params = INonfungiblePositionManager
            .IncreaseLiquidityParams({
                tokenId: tokenId,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 1000
            });
        (, amount0, amount1) = nonfungiblePositionManager.increaseLiquidity(params);

        if (amount0 < amount0Desired) token0.transfer(owner, amount0Desired - amount0);
        if (amount1 < amount1Desired) token1.transfer(owner, amount1Desired - amount1);
    }

    //decrease liquidity and return the amount of token withdrawed in tokensOwed0 and tokensOwed1 - the fees

    function decreasePositionLiquidity(
        uint256 tokenId,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) external payable onlyOwner {
        (, , , , , int24 tickLower, int24 tickUpper, uint128 liquidity, , , , ) = nonfungiblePositionManager.positions(
            tokenId
        );

        IUniswapV3Pool pool = getPoolFromTokenId(tokenId);

        (uint160 sqrtRatioX96, , , , , , ) = pool.slot0();

        uint128 liquidityToDecrease = LiquidityAmounts.getLiquidityForAmounts(
            sqrtRatioX96,
            TickMath.getSqrtRatioAtTick(tickLower),
            TickMath.getSqrtRatioAtTick(tickUpper),
            amount0Desired,
            amount1Desired
        );

        require(liquidityToDecrease <= liquidity, 'cannot decrease more liquidity than the owned');

        INonfungiblePositionManager.DecreaseLiquidityParams memory decreaseliquidityparams = INonfungiblePositionManager
            .DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: liquidityToDecrease,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp + 1000
            });
        nonfungiblePositionManager.decreaseLiquidity(decreaseliquidityparams);
    }

    /*Get pool address from token ID*/
    function getPoolFromTokenId(uint256 tokenId) public view returns (IUniswapV3Pool) {
        (, , address token0, address token1, uint24 fee, , , , , , , ) = nonfungiblePositionManager.positions(tokenId);

        PoolAddress.PoolKey memory key = PoolAddress.getPoolKey(token0, token1, fee);

        address poolAddress = PoolAddress.computeAddress(address(factory), key);

        return IUniswapV3Pool(poolAddress);
    }

    function _getAllUniPosition() external view override returns (uint256[] memory) {
        uint256[] memory uniswapNFTsMemory = uniswapNFTs;
        return uniswapNFTsMemory;
    }

    function _approveToken(IERC20 token) private {
        if (token.allowance(address(this), address(nonfungiblePositionManager)) == 0)
            token.approve(address(nonfungiblePositionManager), 2**256 - 1);
    }

    function _getTokenAddress(uint256 tokenId) private view returns (IERC20 token0, IERC20 token1) {
        (, , address token0address, address token1address, , , , , , , , ) = nonfungiblePositionManager.positions(
            tokenId
        );
        token0 = IERC20(token0address);
        token1 = IERC20(token1address);
    }


    // Modules activation modifier
    /*
    function update(uint i, address moduleAddress, bool activated) external onlyOwnerOrGov {
        Module storage module = modules[i];
        module.moduleAddress  = moduleAddress;
        module.activated      = activated;
    }*/

    //User and governance modifiers
    
    modifier onlyOwner() {
        require(msg.sender == owner, 'Only owner');
        _;
    }
    /*
    modifier onlyGov() {
        require(msg.sender == gov, 'Only gov');
        _;
    }

    modifier onlyOwnerOrGov {
        require((msg.sender == gov) || (msg.sender == owner), 'Only owner or gov');
        _;
    }

    modifier onlyModules(uint index) {
        require(msg.sender == modules[index].moduleAddress, 'Only modules');
        _;
    }

    modifier onlyModulesOrOwner(uint index) {
        require((msg.sender == modules[index].moduleAddress || msg.sender == owner), "Only modules or owner");
        _;
    }

    modifier moduleActivated(uint index) {
        require(modules[index].activated, "Module should be activated");
        _;
    }*/
}
