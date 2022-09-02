//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "hardhat/console.sol";
import "./Project.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";


contract ProjectFactory {
    event ProjectCreated(address newProject, uint fundingGoal, uint fundTimeLength); // Note: you should add additional data fields in this event

//https://ethereum.stackexchange.com/questions/13415/deploy-contract-from-contract-in-solidity
    address[] public contracts;

    function create(uint256 _fundingGoal, uint256 _fundTimeLength) external returns(address projectAddress) {
        // TODO: implement me!
        Project p = new Project(_fundingGoal, _fundTimeLength, msg.sender);
        contracts.push(address(p));

        emit ProjectCreated(address(p), _fundingGoal, _fundTimeLength); // TODO: replace me with the actual Project's address
        return address(p);
    }
}
