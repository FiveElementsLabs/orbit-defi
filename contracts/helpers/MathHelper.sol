// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

library MathHelper {
    ///@dev cast uint24 to int24
    function fromUint24ToInt24(uint24 value) internal pure returns (int24) {
        require(value <= type(uint24).max, "MathHelper::toInt24: value doesn't fit in 24 bits");
        return int24(value);
    }

    ///@dev cast int24 to uint24
    function fromInt24ToUint24(int24 value) internal pure returns (uint24) {
        require(value <= type(int24).max, "MathHelper::toUint24: value doesn't fit in 24 bits");
        return uint24(value);
    }

    ///@dev cast uint256 to uint24
    function fromUint256ToUint24(uint256 value) internal pure returns (uint24) {
        require(value <= uint256(type(uint24).max), "MathHelper::toUint24: value doesn't fit in 24 bits");
        return uint24(value);
    }

    ///@dev cast uint256 to int24
    function fromUint256ToInt24(uint256 value) internal pure returns (int24) {
        require(value <= uint256(type(int24).max), "MathHelper::toInt24: value doesn't fit in 24 bits");
        return int24(value);
    }
}
