# Multisig Project

## Deliverables

My Gnosis Safe can be found here: https://gnosis-safe.io/app/rin:0xfB85A54a134C9c23A5363afD15F2913E616D762E/home

Contracts have been deployed to Rinkeby at the following addresses:

| Contract | Address Etherscan Link | Transaction Etherscan Link |
| -------- | ------- | --------- |
| Multisig | https://rinkeby.etherscan.io/address/0xfB85A54a134C9c23A5363afD15F2913E616D762E | https://rinkeby.etherscan.io/tx/0xdc3465b96301e8d16161c54925cf87c9b84cbecd3b1d17aa8d0113b0c8c21269 |
| Proxy | https://rinkeby.etherscan.io/address/0x0d494EEB91375D7418730E5BD452587224D3A5F0 | https://rinkeby.etherscan.io/tx/0x89989f6eaf679f6739c2b99e97658e94c59b695c49c15c05892a59a5a7724cd9 |
| Logic | https://rinkeby.etherscan.io/address/0xbf16fCC7aF306AB395F0b03244a8E1E19EFE6aBb | https://rinkeby.etherscan.io/tx/0x26541dee02dea63a27a869e7dbdf299af47d0ab5438dfdaca654199d752d1583 |
| LogicImproved | https://rinkeby.etherscan.io/address/0x18228dF1B47A68A2e9A2430e96e883Bc35bF182F | https://rinkeby.etherscan.io/tx/0xa2f5b12fe5116a328c53c86059da90dfb33c36a10c8ea3ea060c2b760c59b781 |

Transaction for transferring the ownership of the **Proxy** contract to the multisig:

| Contract | Transaction Etherscan Link |
| -------- | -- |
| Proxy | https://rinkeby.etherscan.io/tx/0xd8ed535c86b86292c386954f3ce6ba4c729065c623b1b6dfd3727f742c61fdb4 |

Transaction calling `upgrade(address)` to upgrade the **Proxy** from **Logic** -> **LogicImproved**
| Contract | Function called | Transaction Etherscan Link |
| --------------- | --------------- | -- |
| Proxy | `upgrade` | https://rinkeby.etherscan.io/tx/0x1660f0ee749945ff4d206823c833b56de2573abdbd59be1457f6ca2dc0cb9d77 |

# Design exercise

> Consider and write down the positive and negative tradeoffs of the following configurations for a multisig wallet. In particular, consider how each configuration handles the common failure modes of wallet security.

> - 1-of-N
> - M-of-N (where M: such that 1 < M < N)
> - N-of-N

## 1-of-N

### Advantages

* Easy to sign transactions! No need to wait for any other owners to sign
* Very low risk of lost keys leading to inaccessible funds-- just use any other owner to transact

### Disadvantages

* Multiplies risk of attack since if /any/ key is compromised, all funds are compromised
* No other owners verify/double-check that the transactions you are signing are safe and function as intended

### M-of-N (where M: such that 1 < M < N)

### Advantages

* Funds can still be accessed, account transacted from even if one account is lost or inactive
* Even if one account is compromised, ensures security since still needs at least one other account to sign
* At least one additional owner can independently confirm that transactions signed are safe and function as intended

### Disadvantages

* Well actually this is probably the best one
* Requires waiting for at least one additional account to sign off on transactions
* Very slight possibility that multiple accounts could be compromised at the same time

### N-of-N

### Advantages

* Smallest possible risk of compromised transactions, as every single owner would have to have their keys compromised at the same time for attack to succeed
* Highest independent confirmation that all signed transactions are safe and function as intended, as every single owner must review and sign each transaction

### Disadvantages

* If any one set of owner keys are lost, ability to access funds and transact is lost forever-- this is bad.
* Highest effort/wait time for all owners to sign each transaction
