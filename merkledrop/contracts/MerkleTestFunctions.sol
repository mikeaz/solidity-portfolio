//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

contract MerkleTestFunctions {
    //mikeaz: inspired by OZ MerkleProof._hashPair
    function hashPair(bytes32 a, bytes32 b) public pure returns (bytes32 pairHash) {
        bytes32 hashAB = keccak256(abi.encode(a, b));
        bytes32 hashBA = keccak256(abi.encode(b, a));
        if (a < b) {
            return hashAB;
        } else {
            return hashBA;
        }
    }

    function toLeafFormat(address _recipient, uint256 _amount) public pure returns (bytes32) {
        return keccak256(bytes(abi.encode(_recipient, _amount)));
    }
}