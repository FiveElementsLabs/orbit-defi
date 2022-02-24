from brownie import chain, interface
from math import sqrt
import pytest
from web3 import Web3
import random

UNISWAP_V3_CORE = "Uniswap/v3-core@1.0.0"


@pytest.fixture(scope="module")
def gov(accounts):
    yield accounts[0]


@pytest.fixture(scope="module")
def user(accounts):
    yield accounts[1]


@pytest.fixture(scope="module")
def recipient(accounts):
    yield accounts[2]


@pytest.fixture(scope="module")
def keeper(accounts):
    yield accounts[3]


@pytest.fixture(scope="module")
def users(gov, user, recipient, keeper):
    yield [gov, user, recipient, keeper]


@pytest.fixture(scope="module")
def router(TestRouter, gov):
    yield gov.deploy(TestRouter)


@pytest.fixture
def pool(MockToken, router, pm, gov, users):
    UniswapV3Core = pm(UNISWAP_V3_CORE)

    tokenA = gov.deploy(MockToken, "name A", "symbol A", 18)
    tokenB = gov.deploy(MockToken, "name B", "symbol B", 18)
    fee = 3000

    factory = gov.deploy(UniswapV3Core.UniswapV3Factory)
    tx = factory.createPool(tokenA, tokenB, fee, {"from": gov})
    pool = UniswapV3Core.interface.IUniswapV3Pool(tx.return_value)
    token0 = MockToken.at(pool.token0())
    token1 = MockToken.at(pool.token1())

    # initialize price to 2
    price = int(sqrt(0.0005) * (1 << 96))
    pool.initialize(price, {"from": gov})

    for u in users:
        token0.mint(u, 100000e18, {"from": gov})
        token1.mint(u, 1000000e18, {"from": gov})
        token0.approve(router, 10000e18, {"from": u})
        token1.approve(router, 1000000e18, {"from": u})

    # Add some liquidity over whole range
    max_tick = 887272 // 60 * 60
    
    router.mint(pool, -max_tick, max_tick, 1e16, {"from": gov})

    # Increase cardinality and fast forward so TWAP works
    pool.increaseObservationCardinalityNext(100, {"from": gov})
    chain.sleep(3600)
    
    yield pool


@pytest.fixture
def tokens(MockToken, pool):
    return MockToken.at(pool.token0()), MockToken.at(pool.token1())

@pytest.fixture
def userNFT(pool, users):
    tx = router.mint(pool, -60000, 60000, 1e15, {"from": users[0]})
