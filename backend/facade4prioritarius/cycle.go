package facade4prioritarius

import "github.com/sneat-co/prioritarius/backend/models4prioritarius"

// findPath performs a breadth-first search over edges of a single type for a
// path from start to target (both inclusive). Returns nil when unreachable.
// Mirrors prioritarius/libs/core/src/lib/graph.ts findPath exactly.
func findPath(edges []models4prioritarius.EdgeDbo, start, target string) []string {
	if start == target {
		return []string{start}
	}
	adjacency := make(map[string][]string, len(edges))
	for _, e := range edges {
		adjacency[e.From] = append(adjacency[e.From], e.To)
	}

	visited := map[string]bool{start: true}
	predecessor := map[string]string{}
	queue := []string{start}

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		for _, next := range adjacency[current] {
			if visited[next] {
				continue
			}
			visited[next] = true
			predecessor[next] = current
			if next == target {
				path := []string{target}
				node := current
				for node != start {
					path = append([]string{node}, path...)
					node = predecessor[node]
				}
				path = append([]string{start}, path...)
				return path
			}
			queue = append(queue, next)
		}
	}
	return nil
}

// detectCycle checks whether adding a from->to edge to existingEdges (all of
// the SAME edge type) would close a cycle. Returns the existing path (from
// `to` back to `from`) it would close, or nil when it would not.
// Mirrors libs/core's detectCycle exactly.
func detectCycle(existingEdges []models4prioritarius.EdgeDbo, from, to string) []string {
	if from == to {
		return []string{from}
	}
	return findPath(existingEdges, to, from)
}

// edgesOfType returns the subset of edges matching edgeType.
func edgesOfType(edges []models4prioritarius.EdgeDbo, edgeType models4prioritarius.EdgeType) []models4prioritarius.EdgeDbo {
	var out []models4prioritarius.EdgeDbo
	for _, e := range edges {
		if e.Type == edgeType {
			out = append(out, e)
		}
	}
	return out
}
