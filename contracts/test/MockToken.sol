// SPDX-License-Identifier: Unlicense

pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) ERC20(name, symbol) {
        _setupDecimals(decimals);
    }
    
    event  Deposit(address indexed dst, uint wad);  
    event  Withdrawal(address indexed src, uint wad);

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
    
    fallback() external payable {
        deposit();
    }

    function deposit() public payable {
        _mint(msg.sender, msg.value);
        Deposit(msg.sender, msg.value);
    }

    function withdraw(uint wad) public {
        _burn(msg.sender, wad);
        safeTransferETH(msg.sender, wad);
        Withdrawal(msg.sender, wad);
    }

    function safeTransferETH(address payable to, uint256 amount) internal {
        require(address(this).balance >= amount, 'no enough ethers in contract');
        (bool success, ) = to.call{value: amount}("");
        require(success, 'STE token');
    }

}
