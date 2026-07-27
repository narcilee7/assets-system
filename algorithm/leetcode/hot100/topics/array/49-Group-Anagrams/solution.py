from collections import defaultdict

inputs = ["eat", "tea", "tan", "ate", "nat", "bat"]

def groupAnagrams(strs: list[str]) -> list[list[str]]:
    groups = defaultdict(list)
    for s in strs:
        key = "".join(sorted(s))
        groups[key].append(s)

    return list(groups.values())


print(groupAnagrams(inputs))
