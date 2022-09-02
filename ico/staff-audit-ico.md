https://github.com/0xMacro/student.mikeaz/tree/28bd3b89a84c7a789c271eea8232145d2688e783/ico

Audited By: Rares Stanciu

# General Comments

Great job, Michael!

The design of your contracts was straightforward, easy to follow, and understand, which allowed you to write a pretty solid and secure ICO. Also, the frontend is correctly communicating with the smart contract.

You wrote in the README that your whitelist control functions are directly based on OpenZeppelin's WhitelistedCrowdsale contract. I agree that leveraging battle-tested code is smart and less prone to errors than writing it from the ground up. Still, the goal of this bootcamp is to teach you how to write that secure code yourself, learn the pitfalls and vulnerabilities that exist out there, and also how to avoid or fix them. That's why we only allow a small number of contracts to be extended (e.g., only ERC20 for this project).

I have not given you any points for copy-pasting that code since there are only a few lines of code, and you may not have known the importance of writing the entire project all by yourself, but you have received a point because, by copy-pasting it, you added the `removeFromWhitelist` function which was not part of the specs. Be careful in the following projects, as they become more and more complex and the risk of getting flagged for copy-pasting is higher.

I wrote a few suggestions below, mostly around gas optimizations, that should help you reduce the gas footprint of your project (and your following projects as well, as these are general rules that can be applied to pretty much any contract).

Ping me if you want to chat more on any of these topics!

P.S. Please upload the entire project structure (primarily the `package.json` file) for the following projects.

# Design Exercise

Great job on your answer! Very elegant and very well explained.

Another viable solution would be to use periodic SPC releases by dividing the vesting period into N milestones and releasing 1/N tokens on each milestone reached (e.g., for a one-year vesting period of 1 year, releasing 25% of the funds every three months).

# Issues

## **[L-1]** Dangerous Phase Transitions

If the `advancePhase` function is called twice, a phase can accidentally be skipped. There are a few situations where this might occur:

1. Front-end client code malfunction calling the function twice.
2. Human error double-clicking a button on the interface on accident.
3. Repeat invocations with intent - Uncertainty around whether or not a 
transaction went through, or having a delay before a transaction processes, are common occurrences on Ethereum today.

Phase transitions are especially problematic, because once the ICO has advanced to the next phase there is no going back. Compare this to the toggle tax functionality, where it is easy for the owner to fix.

Consider refactoring this function by adding an input parameter that specifies either the expected current phase, or the expected phase to transition to.

## **[Extra-Feature-1]** Removing allowlisted addresses is not part of the spec

This feature increases the attack surface of the contract and deviates from
the spec. Removing addresses means that even after an address
has been added, they are at the mercy of the owner of the ICO, who can
remove them at any time.

## **[Extra-Feature-2]** Updating the treasury address is not part of the spec

This feature increases the attack surface of the contract and deviates from the spec.

Changing the treasury address means that the owner of the ICO can start collecting taxes in a personal wallet at any time.

## **[Q-1]** Immutable values are not using contract storage

If you have values set in your contract constructor and never changed, as `owner` and `treasury` are in both `SpaceCoinICO` and `SpaceCoin`, then you can declare them with the `immutable` keyword. This will save gas as the compiler will not reserve storage for them and instead inline the values where they are used.

## **[Q-2]** Unnecesary setting of storage variables to default values

Every variable type has a default value it gets set to upon declaration. Unnecessarily initializing a variable to its default value costs gas. This can be avoided as follows:

For example:

```solidity
address a;  // will be initialized to the 0 address (address(0))
uint256 b;  // will be initialized to 0
bool c;     // will be initialized to false
```

Consider not setting initial values for storage variables that would otherwise be equal to their default values.

## **[Q-3]** Transfer overrides could be combined

Rather than individually overriding the OZ `transfer` and `transferFrom` functions to collect tax,
you could just override `_transfer`, which they both call.

## **[Q-4]** Duplicate state variables `tokenAddress` and `spaceCoin`

Both variables reference the `SpaceCoin` contract, which makes one of them redundant.

Duplicate and unused storage variables and functions needlessly increase the cost of
deployment and confuse readers of the contract. Please remove them if
they are not used or redundant.

## **[Q-5]** Phase limits can be immutable

Using the two state variables `maxTotalPrivateContrib` and `maxIndividualContrib` for storing the _current_ phase limits is a clean and easy way to do the job.

However, whenever a contribution is made, the EVM must read the storage to load those variables. Although it may look a bit dirtier (compared to the Web2 ways of doing it), it's much more gas efficient to use many immutable variables to hardcode these contribution limits.

For example:

```solidity
  uint256 constant GENERAL_INDIV_CAP = 1_000 * 10 ** 18;
```

An immutable variable takes the hardcoded value and replaces all instances in the contract with that value, thereby no longer requiring a load from storage. You'll learn later in the class that loading and saving from storage are some of the most gas-expensive operations and should be avoided whenever possible.

## **[Q-6]** Ineffective tests

You have multiple tests that do not properly await the transaction, such as:

```ts
it("Event emitted on ICO owner pause", async function () {
  const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(
    deployICO
  );

  expect(await ico.connect(owner).pause(true))
    .to.emit(ico, "Pause")
    .withArgs(true);
});
```

These will pass even if the events are not emitted, the event's name is wrong, or the arguments are wrong. You can try changing the `true` to `false` or changing the event's name in the snippet above.
The correct way of asserting if the event was emitted is:

```ts
it("Event emitted on ICO owner pause", async function () {
  const { ico, spcToken, owner, treasury, alice, bob } = await loadFixture(
    deployICO
  );

  await expect(ico.connect(owner).pause(true))
    .to.emit(ico, "Pause")
    .withArgs(true);
});
```

Note the order of `await` then `expect`, which you need to change in the example above. More generally, test your tests to ensure they fail if the condition they test for is not met.

# Nitpicks

## **[N-1]** Transfer amounts rounding errors

In the `SpaceCoin` contract, you send 2% of the transferred funds to the treasury (as tax) and 98% of the funds to the recipient.
Due to Solidity's integer rounding, there are some cases when the invariant `amount = tax_amount + recipient_amount` does not hold.

For example:

```
amount = 101
tax_amount = 2
recipient_amount = 100
```

Even though this is a tiny error and should not impact the behavior of the smart contract, it's better to make sure that it is as robust as possible without leaving any chances for unexpected values.

Consider computing the tax amount the same way and the amount that goes to the intended recipient as the difference between the initial amount and tax.

# Score

| Reason                     | Score |
| -------------------------- | ----- |
| Late                       | -     |
| Unfinished features        | -     |
| Extra features             | 2     |
| Vulnerability              | -     |
| Unanswered design exercise | -     |
| Insufficient tests         | -     |
| Technical mistake          | -     |

Total: 3

Great job!
