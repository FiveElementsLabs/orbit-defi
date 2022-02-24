import pytest
from brownie import PositionManager, interface, accounts, reverts


def test_constructor(PositionManager, gov, user):
    position_manager = gov.deploy(PositionManager, user)
    assert position_manager.owner() == user


def test_deposit_unit_nft(PositionManager, gov, user, position_manager, ERC721):
    with reverts("ERC721: operator query for nonexistent token"):
        ERC721.safeTransferFrom(user, position_manager.owner(), 22, { "from": user })

#TODO: test deposit if token exists
#TODO: test emit event if token exists
