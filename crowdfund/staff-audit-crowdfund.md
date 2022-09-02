https://github.com/0xMacro/student.mikeaz/tree/1b600e2d5ed37f4adbb3b7675757480d37acdb40/crowdfund

Audited By: Brandon Junus

# General Comments

Great job on your first project!

Overall, I'm very impressed by how simple your code is- I think that your was the most efficent in terms of lines of code out of any project I've seen.

Also, awesome job on not having any major vulerabilities.

Please be sure to take a look at the code quality and nit's I found- while these aren't major issues, they will help you on future projects.

If you have any additional followup questions, or would like to chat for any other reason, please don't hesitate to reach out on discord- Junus.

# Design Exercise

Loved how detailed this answer is! Good intuition on the "push" vs "pull" method- you're correct that we should generally favor a "pull" method in most cases.

I would argue that if we were to create tiered NFTs, a user contributing 3 ETH (for a tier 3 NFT) should recieve an NFT for all three tiers so that the user does not miss out on any of the lower level NFTs just for contributing more.

As a follow up question, do you think you could design a system that does this?

# Issues

**[L-1]** Use of \_mint instead of \_safeMint

In line 139 of Project.sol, NFT's are minted to users with the `ERC721._mint` function. However, this function does not check if the `_to` address is able to handle/receive ERC721 tokens, which would not be the case if the msg.sender was a contract that does not implement the equivalent of the [IERC721Receiver](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC721/IERC721Receiver.sol) interface.

Consider using `_safeMint()` instead of `_mint()` to ensure receiving addresses can handle ERC721 tokens.

Note, using `_safeMint()` opens up a reentrancy attack vector in your contract, so make sure you protect against this attack by following the [checks-effects-interactions](https://docs.soliditylang.org/en/v0.8.13/security-considerations.html?highlight=checks%20effect#use-the-checks-effects-interactions-pattern) pattern in any functions that end up calling `_safeMint`, or adding a ReentrancyGuard modifier

**[Technical Mistake]** Per the spec, all projects are to have a deadline of 30 days

Per the spec:

"
If the project is not fully funded within 30 days:
...
"

and

"
The creator can choose to cancel their project before the 30 days are over, which has the same effect as a project failing.
"

Having a variable fundingTimeLength breaks this specification and, while doesn't introduce any _true_ security vulerabilities, will unforuntately count as a technical mistake.

**[Q-1]** Unchanged variables should be marked constant or immutable

This quality issue is refering to fundingGoal, fundingBalance, startTime, fundTimeLength and owner in Project.sol.

Your contract includes storage variables that are not updated by any functions
and do not change. For these cases, you can save gas and improve readability
by marking these variables as either `constant` or `immutable`.

What's the difference? In both cases, the variables cannot be modified after
the contract has been constructed. For `constant` variables, the value has to
be fixed at compile-time, while for `immutable`, it can still be assigned at
construction time.

Compared to regular state variables, the gas costs of `constant`and `immutable`
variables are much lower. For a `constant` variable, the expression assigned to
it is copied to all the places where it is accessed and also re-evaluated
each time. This allows for local optimizations. `Immutable` variables are
evaluated once at construction time and their value is copied to all the
places in the code where they are accessed. For these values, 32 bytes are
reserved, even if they would fit in fewer bytes. Due to this, `constant` values
can sometimes be cheaper than `immutable` values.

**[Q-2]** fundingSuccess, fundingCancelled, and fundingBalance do not need to be set in constructor of Project.sol

In solidity, variables are set with default falsy values. For bools, these are false, and for uints, these are set to 0.

Setting it again actually costs extra gas on deployment (as it has to read the 0 value to set)!

See: https://ethereum.stackexchange.com/questions/40559/what-are-the-initial-zero-values-for-different-data-types-in-solidity and https://docs.soliditylang.org/en/develop/types.html#delete

**[Q-3]** startTime variable is not needed

In Project.sol, you are only using startTime and fundTimeLength to calculate the deadline (probably what you would call fundTimeEnd given your variable naming).

Instead of using two variables, you create a single variable fundTimeEnd, then in your constructor use:

```
fundTimeEnd = block.timestamp + _fundTimeLength
```

Setting extra variables ultimately costs extra gas! Whenever possible, try to remove extra variables.

If you need to keep track of start time, you could also emit an event on construction for ProjectCreated.

But then again, you could just find the contract's address and find it's creation time. Check
out any contract on etherscan and you should be able to find the transaction that created that contract, for example- https://etherscan.io/tx/0x4077a75cca9a023007542c9e85bbfde7e035b6465d81e7f1427d9b10d9d661d1

**[Q-4]** Leaving hardhat/console.sol in production project

Your contract imports hardhat/console.sol, which is a development package.

Consider removing hardhat/console.sol from your production code.

**[Q-5]** Use NatSpec format for comments

Solidity contracts can use a special form of comments to provide rich
documentation for functions, return variables and more. This special form is
named the Ethereum Natural Language Specification Format (NatSpec).

It is recommended that Solidity contracts are fully annotated using NatSpec
for all public interfaces (everything in the ABI).

Using NatSpec will make your contracts more familiar for others to audit, as well
as making your contracts look more standard.

For more info on NatSpec, check out [this guide](https://docs.soliditylang.org/en/develop/natspec-format.html).

Consider annotating your contract code via the NatSpec comment standard.

# Nitpicks

1. ProjectFactory.sol probably doesn't need a contracts array

You can just query number of projects through number of events emmited. Similarly, you can just get all the addresses of projects created by querying all events emmited.

Also, you might want to add a "creator" variable in the ProjectCreated event, just so you wouldn't have to do an extra query to the project itself to find that info.

2. Your test file has a "ONE_ETHER" variable that you could use throughout your file so you don't have to put keep adding "10000000000000000000" or parseEther everywhere. For future projects, you can also feel free to add other variables like "FIVE_ETHERS" if needed.

3. You can use custom errors in solidity for your require statements(https://blog.soliditylang.org/2021/04/21/custom-errors/). This saves gas!

4. fundingBalance variable may not be needed.

You can simply access the amount of ether in a contract using address(this).balance.

You _could_ aruge that if a malicious user uses self-destruct on this contract, it would have more ether in address(this).balance than totalAmount, but I would argue that this ETH should belong to the owner anyway, as it would be lost otherwise.

Removing this variable and its updates will save gas!

See: https://docs.soliditylang.org/en/develop/units-and-global-variables.html#address-related and https://ethereum.stackexchange.com/questions/21448/how-to-get-a-contracts-balance-in-solidity

5. Unnecessary recipent variable in withdrawOwner and withdrawContributor

Setting this extra variable uses extra gas!

Instead of:

```
address payable recipient = payable(owner);
(bool success, ) = recipient.call{value: _withdrawAmount}("");
```

Consider using:

```
(bool success, ) = payable(owner).call{value: _withdrawAmount}("");
```

6. Consider using onlyOwner modifier

Obviously not a big deal in this project specifically (you only check for if msg.sender is owner in two places), but for larger projects, this may get out of hand!

# Score

| Reason                     | Score |
| -------------------------- | ----- |
| Late                       | -     |
| Unfinished features        | -     |
| Extra features             | -     |
| Vulnerability              | 1     |
| Unanswered design exercise | -     |
| Insufficient tests         | -     |
| Technical mistake          | 1     |

Total: 2

Great job!
