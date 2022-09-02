//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract Project is ERC721 {
    event ContributionMade(address contributor, uint contributionAmount);
    event OwnerWithdrawalMade(uint withdrawalAmount);
    event ContributorWithdrawalMade(uint withdrawalAmount);
    event Cancellation(uint cancelTime);

    uint256 public fundingGoal;
    uint256 public fundingBalance; 
    uint256 public constant MIN_CONTRIBUTION = 0.01 ether;
    uint256 public constant NFT_THRESHOLD = 1 ether;  
    uint256 public startTime;
    uint256 public fundTimeLength;
    address public owner;
    mapping(address => uint256) public amountContributed;

    //for NFT tracking
    uint private _tokenIds;

    //state control variables
    bool public fundingSuccess;
    bool public fundingCancelled;

    //Constructor
    constructor(uint256 _fundingGoal, uint256 _fundTimeLength, address _owner) ERC721("Contributor Badge", "BADGE") {
        require(_owner!=address(0));
        fundingGoal = _fundingGoal;
        fundTimeLength = _fundTimeLength;
        startTime = block.timestamp;
        owner = _owner;
        fundingSuccess = false; 
        fundingCancelled = false;
        fundingBalance = 0;
    }    

    function isFundingOpen() view public returns (bool) {
        if(block.timestamp > startTime + fundTimeLength){
            return false;
        }
        if(fundingCancelled){
            return false;
        }
        if(fundingSuccess){
            return false;
        }
        return true;
    }

    //allow owner to cancel project during any time it's open
    function cancelProject() external {
        require(isFundingOpen(), "funding closed, cannot cancel"); //otherwise there's nothing to cancel
        require(msg.sender == owner, "you are not the owner, cannot cancel");
        fundingCancelled = true;
        emit Cancellation(block.timestamp);
    }

    //take contributions while funding time is open and below goal
    function contribute() external payable {
        require(isFundingOpen(), "cannot contribute, the fund is closed");
        require(msg.value >= MIN_CONTRIBUTION, "cannot contribute, contribution below minimum of 0.01 ETH");

        //First! We're going to modulo existing amountContributed by NFT_THRESHOLD (in case any left over from previous contrib)
        //Then add current contribution to our function-local NFT threshold tracker
        uint nextNftThreshold = amountContributed[msg.sender] % NFT_THRESHOLD + msg.value;

        //update totals tracking
        fundingBalance += msg.value;
        amountContributed[msg.sender] += msg.value;

        //mark as a success if this contrib pushes past the funding goal
        if (fundingBalance >= fundingGoal) {
            fundingSuccess = true;
        }

        emit ContributionMade(msg.sender, msg.value);

        //give contributor an NFT if contribution amt > threshold
        while (nextNftThreshold >= NFT_THRESHOLD) {
            nextNftThreshold -= NFT_THRESHOLD;

            _tokenIds++;
            
            //RE ENTRANCY RISK POINT***
            //Honestly-- I'd prefer to use _mint over _safeMint. It's slightly gas cheaper and has less security risk. 
            _mint(msg.sender, _tokenIds);
        }
    }

    //allow contributor to withdraw if funding fails or is canceled 
    function withdrawContributor() external {
        require(!isFundingOpen(), "cannot withdraw, funding still open");
        require(!fundingSuccess, "cannot withdraw, funding succeeded");
        
        //if funding is not open or a success, then it MUST be either cancelled or failed. in which contributors can withdraw
        uint contributorBalance = amountContributed[msg.sender];
        require(contributorBalance !=0, "no balance for contributor to withdraw");

        amountContributed[msg.sender] = 0;
        fundingBalance -= contributorBalance;
        address payable recipient = payable(msg.sender);

        emit ContributorWithdrawalMade(contributorBalance);

        //https://consensys.github.io/smart-contract-best-practices/development-recommendations/general/external-calls/
        (bool success, ) = recipient.call{value:contributorBalance}("");
        require(success, "Transfer failed.");

    }

    //allow project owner to withdraw if funding succeeds :)
    //okay fine i'll allow partial withdrawals.. y tho
    function withdrawOwner(uint _withdrawAmount) external {
        //require(isFundingOpen() == false); /* really we ONLY need to check fundingSuccess, right? */
        require(fundingSuccess);
        require(msg.sender == owner, "cannot withdraw since you are not the owner");
        require(_withdrawAmount <= fundingBalance);
        fundingBalance -= _withdrawAmount;
        address payable recipient = payable(owner);

        emit OwnerWithdrawalMade(_withdrawAmount);

        //https://consensys.github.io/smart-contract-best-practices/development-recommendations/general/external-calls/
        (bool success, ) = recipient.call{value:_withdrawAmount}("");
        require(success, "Transfer failed.");
    }
}