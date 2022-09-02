// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

interface NftMarketplace {
    function getPrice(address nftContract, uint nftId) external returns (uint price);
    function buy(address nftContract, uint nftId) external payable returns (bool success);
}

contract CollectorDAO is IERC721Receiver{
    address public owner; 
    uint8 constant QUORUM_PERCENTAGE = 25;
    uint constant ONE_WEEK = 604800;
    uint constant ONE_DAY = 86400;

    bool allowDaoBuyInExecution;

    struct ProposalCore {
        uint256 voteStart;
        bool executed;
        uint32 memberCountSnapshot; //need to determine total member count for quorum, populated at time of proposal
        address[] voters; // this will make it easier to keep track of voters updating their votes
        mapping(address => bool) voterSupport;
    }
    mapping(uint256 => ProposalCore) public proposals;

    //keep track of DAO voters and weight
    uint32 public memberCount;
    mapping(address => uint256) public memberWeight;

    struct Contribution {
        uint256 amount;
        uint256 timestamp;
    }
    mapping(address => Contribution[]) public memberWeightHistory;

    function memberContribute() external payable {
        if (memberWeight[msg.sender] == 0) {
            require (msg.value >= 1 ether, "must contribute at least 1 ETH");
            memberCount++;
        }
        memberWeight[msg.sender] += msg.value;
        memberWeightHistory[msg.sender].push(Contribution (msg.value, block.timestamp));
    }

    function getMemberWeightAtTime(address _member, uint256 _timestamp) public view returns (uint256) {
        if (memberWeight[_member] == 0) {return 0;}
        uint256 weightAtTime;
        for (uint i=0; i<memberWeightHistory[_member].length; i++) {
            if (memberWeightHistory[_member][i].timestamp <= _timestamp) {
                weightAtTime += memberWeightHistory[_member][i].amount;
            }
        }
        return weightAtTime;
    }

    enum ProposalState {
        Active,
        Defeated,
        Succeeded,
        Executed
    }
    event ProposalCreated(
        uint256 proposalId,
        address proposer,
        address[] targets,
        uint256[] values,
        string[] signatures,
        bytes[] calldatas,
        uint256 startBlock,
        string description
    );

    event ProposalExecuted(uint256 proposalId);

    function hashProposal (
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public pure returns (uint256) {
        return uint256(keccak256(abi.encode(targets, values, calldatas, descriptionHash)));
    }

    function castVote(uint256 _proposalId, bool _support) public {
        _castVote(_proposalId, _support, msg.sender);
    }

    function _castVote(uint256 proposalId, bool _support, address _voter) internal {
        ProposalCore storage proposal = proposals[proposalId];

        ProposalState status = state(proposalId);
        require(
            status == ProposalState.Active,
            "Governor: proposal not active"
        );

        uint timestamp=proposal.voteStart;
        require(
            getMemberWeightAtTime(_voter, timestamp) > 0,
            "voter has no voting power"
        );

        bool alreadyVoted = false;
        for (uint i=0; i<proposal.voters.length; i++) {
            if (proposal.voters[i] == _voter) {
                //already voted, don't add to voter list
                alreadyVoted = true;
                break;
            }
        }
        if (!alreadyVoted) {proposal.voters.push(_voter);}

        //voter can still update support, but, don't re-add them to the voter list!
        proposal.voterSupport[_voter] = _support;
    }

    function castVoteBySig(address _signer, uint256 _proposalId, bool _support, bytes memory signature) public {
        if (verify(_signer,_proposalId,_support,_signer,signature)) {
            _castVote(_proposalId, _support, _signer);
        } else revert("verify failed");
    }

    function castVotesBySigBulk(address[] memory _signers, uint256[] memory _proposalIds, bool[] memory _supports, bytes[] memory signatures) public {
        require(_signers.length == _proposalIds.length);
        require(_signers.length == _supports.length);
        require(_signers.length == signatures.length);
        for (uint256 i = 0; i < _signers.length; ++i) {
            castVoteBySig(_signers[i],_proposalIds[i],_supports[i],signatures[i]);
        }
    }

    bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");
    bytes32 public constant BALLOT_TYPEHASH = keccak256("Ballot(uint256 _proposalId,bool _support, address _voter)");

    function getMessageHash(
        uint _proposalId,
        bool _support,
        address _voter
    ) public pure returns (bytes32) {
        bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes("CollectorDAO")), 1, "address(this)"));
        bytes32 structHash = keccak256(abi.encode(BALLOT_TYPEHASH, _proposalId, _support, _voter));
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    function getEthSignedMessageHash(bytes32 _messageHash)
        public
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", _messageHash)
            );
    }

    function verify(
        address _signer,
        uint _proposalId,
        bool _support,
        address _voter,
        bytes memory signature
    ) public pure returns (bool) {
        bytes32 messageHash = getMessageHash(_proposalId, _support, _voter);
        bytes32 ethSignedMessageHash = getEthSignedMessageHash(messageHash);

        return recoverSigner(ethSignedMessageHash, signature) == _signer;
    }

    function recoverSigner(bytes32 _ethSignedMessageHash, bytes memory _signature)
        public
        pure
        returns (address)
    {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);

        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    function splitSignature(bytes memory sig)
        public
        pure
        returns (
            bytes32 r,
            bytes32 s,
            uint8 v
        )
    {
        require(sig.length == 65, "invalid signature length");

        assembly {
            /*
            First 32 bytes stores the length of the signature

            add(sig, 32) = pointer of sig + 32
            effectively, skips first 32 bytes of signature

            mload(p) loads next 32 bytes starting at the memory address p into memory
            */

            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }

        // implicitly return (r, s, v)
    }


    function state(uint256 proposalId) public view returns (ProposalState) {
        ProposalCore storage proposal = proposals[proposalId];

        if (proposal.executed) {
            return ProposalState.Executed;
        }

        uint256 voteStart = proposal.voteStart;

        if (voteStart == 0) {
            revert("Governor: unknown proposal id");
        }

        uint256 deadline = voteStart + ONE_WEEK;

        if (deadline >= block.timestamp) {
            return ProposalState.Active;
        }

        if (block.timestamp >= voteStart + ONE_DAY * 10) {
            return ProposalState.Defeated;
        }

        if (_quorumReached(proposalId) && _voteSucceeded(proposalId)) {
            return ProposalState.Succeeded;
        } else {
            return ProposalState.Defeated;
        }
    }

    function _quorumReached(uint256 proposalId) internal view virtual returns (bool) {
        ProposalCore storage proposal = proposals[proposalId];

        if (proposal.voters.length * 100 / proposal.memberCountSnapshot  >= QUORUM_PERCENTAGE) {
            return true;
        } else {
            return false;
        }
    }

    function _voteSucceeded(uint256 proposalId) internal view virtual returns (bool) {
        ProposalCore storage proposal = proposals[proposalId];

        //for a given proposal, iterate through the votes, adding up the voting weights. return true if approve weight > deny weight
        //don't worry about timestamp. assume that if the vote is in the proposal's vote array, it's valid by design

        uint approveTotal;
        uint denyTotal;
        uint timestamp=proposal.voteStart;
        for (uint i=0; i<proposal.voters.length; i++) {
            address voterAddr = proposal.voters[i]; 
            if (proposal.voterSupport[voterAddr]) {
                approveTotal += getMemberWeightAtTime(voterAddr, timestamp);
            } else {
                denyTotal += getMemberWeightAtTime(voterAddr, timestamp);
            }
        }
        if (approveTotal > denyTotal) {
            return true;
        } else {
            return false;
        }
    }




    //https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.6.0/contracts/governance/Governor.sol#L245
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public returns (uint256) {
        //require that proposer has met proposal threshold (2 ETH contrib as per spec)
        require(memberWeight[msg.sender] >= 2 ether, "Governor: proposer below 2 ETH threshold required to propose");

        uint256 proposalId = hashProposal(targets, values, calldatas, keccak256(bytes(description)));

        require(targets.length == values.length, "Governor: invalid proposal length");
        require(targets.length == calldatas.length, "Governor: invalid proposal length");
        require(targets.length > 0, "Governor: empty proposal");

        //Use ProposalCore struct
        ProposalCore storage proposal = proposals[proposalId];

        //make sure proposal doesn't already exist
        require(proposal.voteStart == 0, "Governor: proposal already exists");

        //track time of proposal creation
        proposal.voteStart = block.timestamp;

        //freeze number of members for quorum and votingweight from time of proposal
        proposal.memberCountSnapshot = memberCount;
   

        emit ProposalCreated(
            proposalId,
            msg.sender,
            targets,
            values,
            new string[](targets.length),
            calldatas,
            block.timestamp, //snapshot
            description
        );

        return proposalId;
    }

    //https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.6.0/contracts/governance/Governor.sol#L289
    function execute(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public payable returns (uint256) {
        uint256 proposalId = hashProposal(targets, values, calldatas, descriptionHash);

        //we can put the logic here if proposal is executable 
        ProposalState status = state(proposalId);
        require(
            status == ProposalState.Succeeded,
            "Governor: proposal not successful"
        );
        
        //make sure proposal can only be executed once!
        proposals[proposalId].executed = true;

        emit ProposalExecuted(proposalId);

        //we can just put the meat of this _execute function right here
        //_execute(proposalId, targets, values, calldatas, descriptionHash);
        string memory errorMessage = "Governor: call reverted without message";
        for (uint256 i = 0; i < targets.length; ++i) {
            //flag to allow DAO to call its own buyNFTForDao function
            if (targets[i] == address(this)) {allowDaoBuyInExecution = true;}
            (bool success, bytes memory returndata) = targets[i].call{value: values[i]}(calldatas[i]);
            verifyCallResult(success, returndata, errorMessage);
            if (targets[i] == address(this)) {allowDaoBuyInExecution = false;}
        }

        //AS PER SPEC: Return 0.03 ETH to executor as reward :)
        (bool success2, ) = msg.sender.call{value: 0.03 ether}("");
        require(success2);

        return proposalId;
    }

    //from: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/Address.sol
    function verifyCallResult(
        bool success,
        bytes memory returndata,
        string memory errorMessage
    ) internal pure returns (bytes memory) {
        if (success) {
            return returndata;
        } else {
            _revert(returndata, errorMessage);
        }
    }

    function _revert(bytes memory returndata, string memory errorMessage) private pure {
        // Look for revert reason and bubble it up if present
        if (returndata.length > 0) {
            // The easiest way to bubble the revert reason is using memory via assembly
            /// @solidity memory-safe-assembly
            assembly {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
            }
        } else {
            revert(errorMessage);
        }
    }

    function onERC721Received(address, address, uint256, bytes memory) public override virtual returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function buyNFTForDao(address _NftMarketplace,uint _maxPrice,address _nftAddress,uint _tokenId) external payable  {
        NftMarketplaceContract market = NftMarketplaceContract(_NftMarketplace);

        require(allowDaoBuyInExecution, "Only DAO executed proposal can call this function");

        uint nftCost = market.getPrice(_nftAddress, _tokenId);
        require(nftCost <= _maxPrice, "cannot buy NFT, current price more than willing to pay");
        bool success = market.buy{value: nftCost}(_nftAddress, _tokenId);
        require(success, "buy failed");
    }
}

contract NftMarketplaceContract is NftMarketplace {
    function getPrice(address _nftAddress, uint _tokenId) public override returns (uint) {return 1 ether;}
    function buy(address _nftAddress, uint _tokenId) public payable override returns (bool) {return true;}
}
