// SPDX-License-Identifier: GPL-2.0

pragma solidity >=0.6.0 <0.8.0;

/**
 * @title SafeInt56Math
 * @dev Signed math operations with safety checks that revert on error.
 */
library SafeInt56Math {
    int56 private constant _INT_56_MIN = type(int56).min;

    /**
     * @dev Returns the multiplication of two signed integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `*` operator.
     *
     * Requirements:
     *
     * - Multiplication cannot overflow.
     */
    function mul(int56 a, int56 b) internal pure returns (int56) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
        if (a == 0) {
            return 0;
        }

        require(!(a == -1 && b == _INT_56_MIN), 'SafeInt56Math::mul: multiplication overflow');

        int56 c = a * b;
        require(c / a == b, 'SafeInt56Math::mul: multiplication overflow');

        return c;
    }

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
        require(b != 0, 'SafeInt56Math::div: division by zero');
        require(!(b == -1 && a == _INT_56_MIN), 'SafeInt56Math::div: division overflow');

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
        require((b >= 0 && c <= a) || (b < 0 && c > a), 'SafeInt56Math::sub: subtraction overflow');

        return c;
    }

    /**
     * @dev Returns the addition of two signed integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     *
     * - Addition cannot overflow.
     */
    function add(int56 a, int56 b) internal pure returns (int56) {
        int56 c = a + b;
        require((b >= 0 && c >= a) || (b < 0 && c < a), 'SafeInt56Math::add: addition overflow');

        return c;
    }
}
