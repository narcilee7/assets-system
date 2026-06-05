#!/usr/bin/env python3
"""
Simplified Raft leader election and log replication simulator.
Run: python3 raft_sim.py
"""

import random
import time
from enum import Enum
from typing import List, Dict, Optional


class State(Enum):
    FOLLOWER = "Follower"
    CANDIDATE = "Candidate"
    LEADER = "Leader"


class Node:
    def __init__(self, node_id: int, peers: List[int]):
        self.id = node_id
        self.peers = peers
        self.state = State.FOLLOWER
        self.term = 0
        self.voted_for: Optional[int] = None
        self.log: List[Dict] = []
        self.commit_index = 0
        self.next_index: Dict[int, int] = {}
        self.match_index: Dict[int, int] = {}
        self.election_timeout = random.uniform(0.15, 0.30)
        self.last_heartbeat = time.time()

    def reset_election_timer(self):
        self.last_heartbeat = time.time()

    def election_due(self) -> bool:
        return time.time() - self.last_heartbeat > self.election_timeout

    def become_candidate(self):
        self.state = State.CANDIDATE
        self.term += 1
        self.voted_for = self.id
        self.reset_election_timer()
        print(f"[Node {self.id}] -> Candidate (term {self.term})")

    def become_leader(self):
        self.state = State.LEADER
        for p in self.peers:
            self.next_index[p] = len(self.log) + 1
            self.match_index[p] = 0
        print(f"[Node {self.id}] -> Leader (term {self.term})")

    def request_vote(self, nodes: Dict[int, "Node"]) -> int:
        votes = 1
        for p in self.peers:
            peer = nodes[p]
            if peer.term > self.term:
                self.term = peer.term
                self.state = State.FOLLOWER
                return 0
            if peer.term == self.term and (peer.voted_for is None or peer.voted_for == self.id):
                peer.voted_for = self.id
                votes += 1
        return votes

    def append_entries(self, nodes: Dict[int, "Node"], command: str):
        if self.state != State.LEADER:
            return
        self.log.append({"term": self.term, "command": command})
        index = len(self.log)
        acks = 1
        for p in self.peers:
            peer = nodes[p]
            if peer.term > self.term:
                self.term = peer.term
                self.state = State.FOLLOWER
                return
            # Simplified: always succeed if term matches
            peer.log.append({"term": self.term, "command": command})
            acks += 1
        if acks > len(nodes) // 2:
            self.commit_index = index
            print(f"[Node {self.id}] Committed index {index}: {command}")

    def heartbeat(self, nodes: Dict[int, "Node"]):
        if self.state != State.LEADER:
            return
        for p in self.peers:
            nodes[p].reset_election_timer()


def demo():
    nodes = {}
    for i in range(3):
        peers = [j for j in range(3) if j != i]
        nodes[i] = Node(i, peers)

    print("=== Raft Leader Election ===")
    # Trigger election on node 0
    nodes[0].become_candidate()
    votes = nodes[0].request_vote(nodes)
    if votes > len(nodes) // 2:
        nodes[0].become_leader()
    else:
        print("Split vote, retry...")

    print("\n=== Log Replication ===")
    if nodes[0].state == State.LEADER:
        nodes[0].append_entries(nodes, "SET x = 1")
        nodes[0].append_entries(nodes, "SET y = 2")

    print("\n=== Node States ===")
    for i, n in nodes.items():
        print(f"  Node {i}: {n.state.value}, term={n.term}, log_len={len(n.log)}, commit={n.commit_index}")


if __name__ == "__main__":
    demo()
