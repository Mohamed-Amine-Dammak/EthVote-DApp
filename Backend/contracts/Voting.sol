pragma solidity >=0.8.19;

contract Voting {
    // Struct for candidates
    struct Candidate {
        string name;
        uint voteCount;
    }

    // Array of candidates
    Candidate[] public candidates;

    // Mapping to track if an address has voted (one vote per account)
    mapping(address => bool) public hasVoted;

    // Event emitted on each vote for real-time listening
    event Voted(address indexed voter, uint indexed candidateIndex, string candidateName);

    // Constructor: Initialize with sample candidates (e.g., "Candidate A" and "Candidate B")
    constructor() {
        candidates.push(Candidate("Candidate A", 0));
        candidates.push(Candidate("Candidate B", 0));
    }

    // Vote function: Only if not voted yet
    function vote(uint candidateIndex) public {
        require(candidateIndex < candidates.length, "Invalid candidate index");
        require(!hasVoted[msg.sender], "You have already voted");

        hasVoted[msg.sender] = true;
        candidates[candidateIndex].voteCount++;

        emit Voted(msg.sender, candidateIndex, candidates[candidateIndex].name);
    }

    // Get vote count for a candidate
    function getCandidateVotes(uint candidateIndex) public view returns (uint) {
        require(candidateIndex < candidates.length, "Invalid candidate index");
        return candidates[candidateIndex].voteCount;
    }

    // Get total candidates count
    function getCandidatesCount() public view returns (uint) {
        return candidates.length;
    }
}