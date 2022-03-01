import pytest
from brownie import PositionManager, interface, accounts, reverts
from web3 import Web3
import time


def test_constructor(PositionManager, gov, user, position_manager):
    print(position_manager.owner())
    assert position_manager.owner() == user


def test_deposit_unit_nft(gov, user, position_manager, ERC1155, router, pool, tokenId):
    with reverts("ERC1155: insufficient balance for transfer"):
        position_manager.depositUniNft(user, 22, 1, { "from": user })

    max_tick = 887272 // 60 * 60
    tx = router.mint(pool, -max_tick, max_tick, 1e16, {"from": gov})

    print("events")
    print(tx.events)
    print("token id")
    print(tokenId)

    tx = position_manager.depositUniNft(user, 22, 1, { "from": user })

    tx.wait(1)

    balance = ERC1155.balanceOf(position_manager.owner(), 22)
    tx.wait(1)
    print(balance)

    '''
    tx = ERC1155.safeTransferFrom(user, position_manager.owner(), 22, 0, "0x0", { "from": user })
    tx.wait(1)

    new_balance = ERC1155.balanceOf(position_manager.owner(), 22)
    tx.wait(1)
    print(new_balance)
    '''