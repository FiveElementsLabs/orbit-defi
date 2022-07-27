// SPDX-License-Identifier: GPL-2.0

pragma solidity 0.7.6;

/**
 * @title SafeInt56Math
 * @dev Signed math operations with safety checks that revert on error.
 */
library SafeInt56Math {
    int56 private constant _INT_56_MIN = type(int56).min;

    /**
     * @dev Returns the integer division of two signed integers. Reverts on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function div(int56 a, int56 b) internal pure returns (int56) {
        require(b != 0, 'SM6');
        require(!(b == -1 && a == _INT_56_MIN), 'SM7');

        int56 c = a / b;

        return c;
    }

    /**
     * @dev Returns the subtraction of two signed integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     *
     * - Subtraction cannot overflow.
     */
    function sub(int56 a, int56 b) internal pure returns (int56) {
        int56 c = a - b;
        require((b >= 0 && c <= a) || (b < 0 && c > a), 'SM8');

        return c;
    }
}
