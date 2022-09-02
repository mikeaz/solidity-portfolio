// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title An ICO fundraiser for the SpaceCoin Project
/// @author Michael Azorin
contract SpaceCoinICO {
    event Pause(bool isPaused);
    event PhaseAdvance(uint currentPhase);
    event Investment(address investor, uint value, uint currentPhase);
    event TokensClaimed(address claimAddr, uint amountClaimed);

    address public owner;
    address public tokenAddress;
    address public treasury;
    SpaceCoin internal spaceCoin;

    uint public currentPhase = 1; // 1 = seed, 2 = general, 3 = open
    bool public isPaused = false;
    
    /// @dev https://github.com/ConsenSysMesh/openzeppelin-solidity/blob/master/contracts/crowdsale/validation/WhitelistedCrowdsale.sol
    mapping(address => bool) public whitelist;

    /// @dev initialize to seed phase amounts
    uint256 internal maxTotalPrivateContrib = 15_000 ether; 
    uint256 internal maxIndividualContrib = 1_500 ether;
    uint256 public totalPrivateContrib;

    /// @dev keep track per address with a map (only need to add to in phase 1/2)
    mapping(address => uint256) public totalClaimableContrib;


    constructor(address _treasury) { 
        owner = msg.sender;
        treasury = _treasury;

        /// @dev deploy SpaceCoin ERC20 (and get back total supply 500k)
        spaceCoin = new SpaceCoin(msg.sender, _treasury);
        tokenAddress = address(spaceCoin);

        /// @dev now transfer 350k to treasury
        /// @dev using "ether" to represent 10^18, but this actually represents amount SPC, not ether
        bool success = spaceCoin.transfer(_treasury, 350_000 ether); 
        require(success, "Transfer failed.");
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner can do that");
        _;
    }

    /// @notice allow owner to withdraw contributed ETH to treasury
    function withdraw(uint256 _amount) external onlyOwner {
        require (_amount <= address(this).balance, "contract eth balance less than requested");
        (bool sent, ) = treasury.call{value: _amount}("");
        require(sent, "Failed to send Ether");        
    }

    /// @notice pause state control function
    function pause(bool _isPaused) external onlyOwner {
        isPaused = _isPaused;
        emit Pause(isPaused);
    }

    /// @notice phase control function
    function advancePhase() external onlyOwner {
        require(currentPhase < 3, "cannot advance past open phase"); 
        currentPhase++;
        if (currentPhase == 2) {
            maxTotalPrivateContrib = 30_000 ether;
            maxIndividualContrib = 1_000 ether;
        }
        if (currentPhase == 3) {
            maxIndividualContrib = 30_000 ether;
        }
        emit PhaseAdvance(currentPhase);
    }

    /// @notice whitelist control function
    /// @dev based on https://github.com/ConsenSysMesh/openzeppelin-solidity/blob/master/contracts/crowdsale/validation/WhitelistedCrowdsale.sol
    function addToWhitelist(address _beneficiary) external onlyOwner {
        whitelist[_beneficiary] = true;
    }

    /// @notice whitelist control function
    /// @dev based on https://github.com/ConsenSysMesh/openzeppelin-solidity/blob/master/contracts/crowdsale/validation/WhitelistedCrowdsale.sol
    function addManyToWhitelist(address[] calldata _beneficiaries) external onlyOwner  {
        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            whitelist[_beneficiaries[i]] = true;
        }
    }

    /// @notice whitelist control function
    /// @dev based on https://github.com/ConsenSysMesh/openzeppelin-solidity/blob/master/contracts/crowdsale/validation/WhitelistedCrowdsale.sol
    function removeFromWhitelist(address _beneficiary) external onlyOwner {
        whitelist[_beneficiary] = false;
    }



    function invest() external payable {
        require(!isPaused, "cannot invest, currently paused");

        /// @dev at any phase check that this investment doesn't put us over max total
        require(totalPrivateContrib + msg.value <= maxTotalPrivateContrib, "investment exceeds max total private investment for this phase");    

        /// @dev phase seed check whitelist
        if (currentPhase == 1) {
            //require msg.sender on the whitelist
            require(whitelist[msg.sender], "cannot invest in seed phase, address not whitelisted");
        }

        /// @dev for every phase! put effect here before .transfer interaction as is good practice
        totalPrivateContrib += msg.value;

        /// @dev phase seed or general, check if under individual contrib limit and record total amount of ETH invested for later claiming
        if (currentPhase == 1 || currentPhase == 2) {
            if (totalClaimableContrib[msg.sender] + msg.value > maxIndividualContrib) {
                revert OverIndividualContribLimit(totalClaimableContrib[msg.sender] + msg.value, maxIndividualContrib);
            }
            totalClaimableContrib[msg.sender] += msg.value;
        }

        emit Investment(msg.sender, msg.value, currentPhase);

        /// @dev phase open, no individual contrib limit, immediately give the $SPC tokens
        if (currentPhase == 3) {
            /// @dev nothing else to check, no need to keep track individually
            bool success = spaceCoin.transfer(msg.sender, msg.value*5);
            require(success, "Transfer failed.");
        }
    }

    /// @notice allow early SEED or GENERAL investors to claim actual SPC tokens in phase OPEN
    function claimToken() external {
        require(totalClaimableContrib[msg.sender] > 0, "no SPC tokens to claim from seed or general phase investments");
        require(currentPhase == 3, "cannot claim tokens, not yet in open phase"); /// @dev can only claim in open phase
        /// @dev need to multiply ETH value donated by 5 to get $SPC amount we give
        uint amountSPCtoSend = totalClaimableContrib[msg.sender] * 5;
        totalClaimableContrib[msg.sender] = 0;
        emit TokensClaimed(msg.sender, amountSPCtoSend);
        bool success = spaceCoin.transfer(msg.sender, amountSPCtoSend);
        require(success, "Transfer failed.");
    }    
    
    error OverIndividualContribLimit(uint currentInvidualContribs, uint contribValue);
}

contract SpaceCoin is ERC20 {
    bool public transferTaxOn = false;
    address public owner;
    address public treasury;
    
    constructor(address _owner, address _treasury) ERC20("SpaceCoin", "SPC") { 
        owner = _owner;
        treasury = _treasury;
        _mint(msg.sender, 500_000 ether);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner can do that");
        _;
    }

    function enableTransferTax(bool _transferTaxOn) external onlyOwner {
        transferTaxOn = _transferTaxOn;
    }    

    /* remove extra feature
    function setTreasuryAddress(address _treasury) external onlyOwner {
        treasury = _treasury;
    }*/

    /// @notice override of ERC20 transfer function to support transfer tax
    /// @dev based on @openzeppelin/contracts/token/ERC20/ERC20.sol
    function transfer(address to, uint256 amount) public override returns (bool) {
        address sender = msg.sender;
        if(transferTaxOn) {
            uint256 transferTax = amount * 2 / 100;
            _transfer(sender, to, amount - transferTax);
            _transfer(sender, treasury, transferTax);
        } else {
            _transfer(sender, to, amount);
        }
        return true;
    }

    /// @notice override of ERC20 transferFrom function to support transfer tax
    /// @dev based on @openzeppelin/contracts/token/ERC20/ERC20.sol
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public override returns (bool) {
        address spender = msg.sender;
        _spendAllowance(from, spender, amount);
        if(transferTaxOn) {
            _transfer(from, to, amount * 98 / 100);
            _transfer(from, treasury, amount * 2 / 100);
        } else {
            _transfer(from, to, amount);
        }        return true;
    }    
}