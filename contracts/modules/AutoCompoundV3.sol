// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import '../../interfaces/IPositionManager.sol';
import '../../interfaces/IUniswapAddressHolder.sol';
import '../helpers/NFTHelper.sol';
import '../helpers/ERC20Helper.sol';
import '../utils/Storage.sol';
import '../actions/CollectFees.sol';
import '../actions/IncreaseLiquidity.sol';
import 'hardhat/console.sol';

contract AutoCompoundModuleV3 {
    //TODO: setup registry
    IUniswapAddressHolder addressHolder;
    uint256 feesThreshold;
    address collectFeeAddress;
    address increaseLiquidityAddress;
    address decreaseLiquidityAddress;
    address updateFeesAddress;

    constructor(
        address _addressHolder,
        uint256 _feesThreshold,
        address _collectFeeAddress,
        address _increaseLiquidityAddress,
        address _decreaseLiquidityAddress,
        address _updateFeesAddress
    ) {
        addressHolder = IUniswapAddressHolder(_addressHolder);
        feesThreshold = _feesThreshold;
        collectFeeAddress = _collectFeeAddress;
        increaseLiquidityAddress = _increaseLiquidityAddress;
        decreaseLiquidityAddress = _decreaseLiquidityAddress;
        updateFeesAddress = _updateFeesAddress;
    }

    ///@notice executes our recipe for autocompounding
    ///@param positionManager address of the position manager
    ///@param tokenId id of the token to autocompound
    function autoCompoundFees(IPositionManager positionManager, uint256 tokenId) public {
        ///@devcheck if autocompound is active
        console.log('pre module state: ', positionManager.getModuleState(tokenId, address(this)));
        if (positionManager.getModuleState(tokenId, address(this))) {
            console.log('pre check');
            //console.log(checkIfCompoundIsNeeded(address(positionManager), tokenId));
            if (true) {
                console.log('pre action');
                (uint256 amount0Desired, uint256 amount1Desired) = ICollectFees(
                    0x763e69d24a03c0c8B256e470D9fE9e0753504D07
                ).collectFees(tokenId);

                console.log('pre do action');
                IIncreaseLiquidity(0x763e69d24a03c0c8B256e470D9fE9e0753504D07).increaseLiquidity(
                    tokenId,
                    amount0Desired,
                    amount1Desired
                );
            }
        }
    }

    ///@notice checks the position status
    ///@param positionManagerAddress address of the position manager
    ///@param tokenId token id of the position
    ///@return true if the position needs to be collected
    function checkIfCompoundIsNeeded(address positionManagerAddress, uint256 tokenId) internal returns (bool) {
        console.log('inside check');
        bytes memory data = IPositionManager(positionManagerAddress).doAction(updateFeesAddress, abi.encode(tokenId));

        (uint256 uncollectedFees0, uint256 uncollectedFees1) = abi.decode(data, (uint256, uint256));
        (uint256 amount0, uint256 amount1) = NFTHelper._getAmountsfromTokenId(
            tokenId,
            INonfungiblePositionManager(addressHolder.nonfungiblePositionManagerAddress()),
            addressHolder.uniswapV3FactoryAddress()
        );

        uint256 token0OverFees = 2**256 - 1;
        uint256 token1OverFees = 2**256 - 1;

        if (uncollectedFees0 > 0) {
            token0OverFees = amount0 / uncollectedFees0;
        }
        if (uncollectedFees1 > 0) {
            token1OverFees = amount1 / uncollectedFees1;
        }
        return (token0OverFees < feesThreshold || token1OverFees < feesThreshold);
    }
}
