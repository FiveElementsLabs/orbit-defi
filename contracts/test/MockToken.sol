// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract MockToken is ERC20 {
    constructor(
        string memory nameMock,
        string memory symbolMock,
        uint8 decimalsMock
    ) ERC20(nameMock, symbolMock) {
        _setupDecimals(decimalsMock);
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}
