# LP Project

## Technical Spec
<!-- Here you should list the technical requirements of the project. These should include the points given in the project spec, but will go beyond what is given in the spec because that was written by a non-technical client who leaves it up to you to fill in the spec's details -->

### ICO Contract

- Add a withdraw function to your ICO contract that allows you to move the invested funds out of the ICO contract and into the treasury address.

### Liquidity Pool Contract

Implement a liquidity pool for ETH-SPC. You will need to:

- Write an ERC-20 contract for your pool's LP tokens
- Write a liquidity pool contract that:
  - Mints LP tokens for liquidity deposits (ETH + SPC tokens)
  - Burns LP tokens to return liquidity to holder
  - Accepts trades with a 1% fee

Use [OpenZeppelin's implementation](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol) for the LP tokens.

### SpaceRouter

Transferring tokens to an LP pool requires two transactions:

1. Trader grants allowance on the Router contract for Y tokens.
2. Trader executes a function on the Router which pulls the funds from the Trader and transfers them to the LP Pool.

Write a router contract to handles these transactions. Be sure it can:

- Add / remove liquidity, rejecting if the slippage is above the given amount
- Swap tokens, rejecting if the slippage is above a given amount. You do not have to take the 2% SPC tax into account when calculating slippage.

### Frontend

Extend the given frontend to enable:

1. LP Management

- Allow users to deposit ETH and SPC for LP tokens (and vice-versa)

1. Trading

- Allow users to trade ETH for SPC (and vice-versa)
- Configure max slippage
- Show the estimated trade value they will be receiving

## Usage Notes

A note on transfer tax behavior for quotes and swaps: The core LP functions quoteTokenForEth and quoteEthForToken have no awareness of SPC transfer tax. This is by design. These quotes represent the actual amount of tokens the LP will attempt to send out based on the amount of tokens it receives to swap on top of its reserve balance. Functionally, this transfer tax behaves as a 2% slippage.

<u>SPC Tax On, Swap SPC -> ETH</u>

When SPC transfer tax is on, the LP will receive ~2% less SPC tokens than the user sends due to tax. The front end user should take this into account and increase their slippage by 2%, else the swap will revert. 

<u>SPC Tax On, Swap ETH -> SPC</u>

When SPC transfer tax is on, the swapper will receive ~2% less SPC tokens than the LP sends due to tax. LP function swapEthForToken takes the SPC transfer tax into account, and will return the amount SPC that the swapper will actually recieve, so that the router function swapExactEthForToken may revert the transaction if the final amount recieved is less than the specified amountOutMin. The front end user should take this into account and increase their slippage by 2%, else the swap will revert. 

## Design Exercise Answer

<!-- Answer the Design Exercise. -->
<!-- In your answer: (1) Consider the tradeoffs of your design, and (2) provide some pseudocode, or a diagram, to illustrate how one would get started. -->

> How would you extend your LP contract to award additional rewards – say, a separate ERC-20 token – to further incentivize liquidity providers to deposit into your pool?

A common way to incentivize liquidity providers is by providing protocol tokens to stakers of LP tokens. Liquidity providers can deposit their LP tokens in a staking contract that rewards LP's with more SPC tokens. This works for the SpaceCoin ICO since the treasury is holding a large amount of the total SPC supply. A certain number of SPC tokens can be transferred from the treasury to the staking contract. The SPC devs can decide what the schedule for SPC staking reward emissions are, likely on a schedule of years. 

The staking contract will track how many LP tokens are deposited per block, and how many reward tokens are given out per block. A well-known implementation of staking rewards is SushiSwap's MasterChef staking rewards contract. 

Sushi's MasterChefV2 on GitHub: https://github.com/sushiswap/sushiswap/blob/archieve/canary/contracts/MasterChefV2.sol

```solidity
    function pendingSushi(uint256 _pid, address _user) external view returns (uint256 pending) {
        PoolInfo memory pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accSushiPerShare = pool.accSushiPerShare;
        uint256 lpSupply = lpToken[_pid].balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 blocks = block.number.sub(pool.lastRewardBlock);
            uint256 sushiReward = blocks.mul(sushiPerBlock()).mul(pool.allocPoint) / totalAllocPoint;
            accSushiPerShare = accSushiPerShare.add(sushiReward.mul(ACC_SUSHI_PRECISION) / lpSupply);
        }
        pending = int256(user.amount.mul(accSushiPerShare) / ACC_SUSHI_PRECISION).sub(user.rewardDebt).toUInt256();
    }
```

The trade-off that the protocol has to consider is how much they want their SPC emissions to be. With very high emissions, they will encourage LP's to stake, but risk encouraging high sell pressure on the SPC, lowering the price. And this will burn through the treasury value quickly. 

## Testnet Deploy Information

| Contract | Address Etherscan Link |
| -------- | ------- |
| SpaceCoin | https://rinkeby.etherscan.io/address/0x532d656aeFe25DA641DA5568566f54F1559247B6 |
| ICO | https://rinkeby.etherscan.io/address/0x11267125060727A2559511F5c8710e0f826FA81E |
| Router | https://rinkeby.etherscan.io/address/0x7E29107A3e7A76f4c63B18c40D764b03E4e8Cab3 |
| Pool | https://rinkeby.etherscan.io/address/0x41D8f1f13556b2964c4Af7Ab374882A9ac197FCF |

## Useful Commands

Try running some of the following commands:

```shell
npx hardhat help
npx hardhat compile              # compile your contracts
npx hardhat test                 # run your tests
npm run test                     # watch for test file changes and automatically run tests
npx hardhat coverage             # generate a test coverage report at coverage/index.html
GAS_REPORT=true npx hardhat test # run your tests and output gas usage metrics
npx hardhat node                 # spin up a fresh in-memory instance of the Ethereum blockchain
npx prettier '**/*.{json,sol,md}' --write # format your Solidity and TS files
```