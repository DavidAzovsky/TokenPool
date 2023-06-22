# TokenPool

TokenPool contract provides a service where people can deposit the determined token and they will receive weekly rewards in another reward token. Users must be able to take out their deposits along with their portion of rewards at any time. New rewards are deposited manually into the pool by the team each week using a contract function.
And when the user deposits tokens, they can decide whether to compound existing rewards or not. (If deposit token and reward token is different, it show swap the token – For this build Uniswap Oracle contract and swap via Uniswap router).

## TokenPoolFactory

TokenPoolFactory contract can create TokenPool contracts for different tokens (ETH, ERC20)

# Address

## Ethereum Mainnet:

WETH: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
WBTC: 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599
DAI: 0x6B175474E89094C44Da98b954EedeAC495271d0F
LinkToken: 0x514910771AF9Ca656af840dff83E8264EcF986CA

UniswapV2Router: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
UniswapV2Factory: 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f
UniswapPair WBTC/LinkToken: 0x8a01ba64fbc7b12ee13f817dfa862881fec531b8
UniswapPair DAI/LinkToken: 0x6d4fd456edeca58cf53a8b586cd50754547dbdb2
