# Sudoku Audit

The code in this project is not mine-- thankfully. It's riddled with many critical issues. This is my security audit of these flawed contracts.

## Sudoku

#### High Severity Issues

##### [H-1] No require statement for challengeReward.solved == false, any valid solution can be repeatedly called, draining the reward contract

In SudokuExchange.sol, line 59, in function claimReward:

```solidity
        challengeReward.solved = true;
```

This variable is not checked anywhere, so setting it as true has no effect. If a solver has a valid solution, they can call claimReward repeatedly and drain the contract of an ERC20 token since there is no check if it is already solved. Consider adding a require statement to check this variable before processing a reward. See issue [L-2] since this audit suggests the "solved" variable be stored differently. 

##### [H-2] No check for successful token transfer to reward contract in createReward, anyone can create a new reward which can drain rewards contract without actually sending tokens

In SudokuExchange.sol, line 38, in function createReward:

```solidity
        challengeReward.token.transferFrom(msg.sender, address(this), challengeReward.reward);
```

The return value for this transferFrom function is not checked. If the transfer fails, ex/ if the sender does not have enough tokens, the reward will still be created, and if solved, the contract will send what ERC20 tokens it does have. A malicious user could create a challenge with the exact ERC20 balance of the contract, send nothing, solve it, and drain the contract. Consider adding a bool success require pattern or using SafeERC20 safeTransferFrom. 

##### [H-3] Validate function can hide malicious code, arbitrary functionality 

Creating challenges as individually deployed contracts with an executable function is a massive security risk. A malicious challenge could drain the entire wallets of solvers once claimReward calls challenge.validate. At the very least, a challenge proposer could change the code of validate in a way where it no longer functions properly. It could fail to validate valid solutions, falsely validates false solutions, refuse validating solutions from particular solvers, or any array of all types of strange behaviors. Consider storing the challenges in an array in SudokuExchange which could be accessed by nonce per new challenge. Consider moving the validate function to the SudokuExchange contract where it can be immutable and not editable by challenge proposers. See [G-1] and [G-2] for corresponding gas savings for these changes. 

##### [H-4] Challenge rewards can be overwritten, lose track of rewards

The createReward function can be called repeatedly with different token and reward values for the same challenge. This will overwrite previous rewards, potentially trapping ERC20 tokens in the contract, as only the last added reward will be processed by the claimReward function. Consider pushing new rewards to the end of the map for each challenge. They can then be iterated through when the reward is claimed. 

Existing code:

```solidity
    mapping(address => ChallengeReward) rewardChallenges;
...
        rewardChallenges[address(challengeReward.challenge)] = challengeReward;

```

Example improvement (pseudo-code-- I did not try to compile this. Actual syntax may be different):

```solidity
    mapping(address => ChallengeReward[]) rewardChallenges;
...
    	rewardChallanges[address(challengeReward.challenge)].push(challengeReward);
```

##### [H-5] Reward design susceptible to MEV/Dark Forest effects of address replacement attacks

If a solver submits their solution to the actual Ethereum mempool, there is a high chance that an opportunistic mempool observer would re-submit the solution at higher priority from their own address after seeing that its execution is profitable for any msg.sender. This is a difficult problem to solve completely-- data sent to the mempool is transparent, and if there's value in being the first to submit it, it is susceptible to third parties re-submitting it and ordering it first. At the very least, verifying a valid solution and then pulling the reward as two separate transactions would make it less obvious to bots how to profit from the solutions themselves. But the core design of submitting a solution via a public block-chain is inherently insecure. 

### Medium Severity Issues

##### [M-1] Token transfer to solver is not checked for success

Line 54:

```solidity
        challengeReward.token.transfer(address(this), challengeReward.reward);	
```

If transfer fails, solver can fail to recieve their reward tokens but challenge will still be marked as solved. Consider adding a bool success require pattern or using SafeERC20 safeTransfer function. 

##### [M-2] Call to challenge.validate in claimReward is re-entrant

There are bigger issues with the validate function, see [H-3], but as long as it trigger external code, it should be placed after any effects in claim reward, such as token transfer or setting solved to true. This is good security practice to avoid unexpected behavior, following C-E-I function flow. 

### Low Severity Issues

##### [L-1] The solved bool should not be stored in the ChallengeReward struct

challengeReward.solved can be initialized as true by the proposer, which should not be possible. The solved property should exist at the same level as the rewardChallenges map. There could be an isRewardSolved map at the same level as rewardChallenges. Challenges are being solved, not rewards. Code structure should reflect this. 

### Gas Optimizations

##### [G-1] New contract deployment for every new Sudoku challenge is incredibly expensive

CREATE is the most expensive opcode. Each newly created SudokuChallenge contract has one storage variable. Just put them as an array in SudokuExchange. There's no need to deploy a whole new contract. 

##### [G-2] Re-deploying validate function for every new Sudoku challenge is wasteful and expensive

Besides the eggregious security issues noted in [H-3], redeploying the same validate function repeatedly is wasteful and expensive. Please move the validate function to the Exchange contract. 

##### [G-3] In function createReward, challengeReward argument can be passed as calldata instead of allocating memory

This variable is only read and not updated, passing it as calldata will easily improve gas consumption.

##### [G-4] uint8[81] is an inefficient data type for storing sudoku puzzles

Storing digits 0-9 individually in a uint8 array will be mostly zeroes. This data can be packed more efficiently. 

https://www.britannica.com/story/will-we-ever-run-out-of-sudoku-puzzles - "There are 6,670,903,752,021,072,936,960 possible solvable Sudoku grids" =~ 6.67e21. 

Consider storing a hash of the game grid and passing the actual game grid as calldata when needed. Or at the least packing the data in a less wasteful manner.  

### Code Quality Issues

##### [Q-1] constructor does not need public identifier

SudokuExchange.sol line 32:

```solidity
    constructor() public {
```

SudokuChallenge.sol line 46:

```solidity
    constructor(uint8[81] memory _challenge) public {
```

Just take it out the "public". Even the compiler complains about this. 

##### [Q-2] Remove console.sol import for production code

##### [Q-3] SudokuChallenge challenge variable should be immutable

If setting challenge via the constructor in a newly deployed contract, it should be marked as immutable since it will not change once constructed. 
