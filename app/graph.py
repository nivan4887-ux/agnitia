"""
BRIDGE – Dependency graph logic (NetworkX).

The graph is a directed graph where an edge A → B means "B depends on A"
(i.e. A must be healthy before B can function).
"""

from __future__ import annotations

import networkx as nx

# ---------------------------------------------------------------------------
# Service definitions
# ---------------------------------------------------------------------------

SERVICES: list[str] = [
    "database",
    "backend_api",
    "order_service",
    "payment_service",
    "website",
]

# Edges: (upstream, downstream) – downstream depends on upstream.
DEPENDENCIES: list[tuple[str, str]] = [
    ("database", "backend_api"),
    ("backend_api", "order_service"),
    ("backend_api", "payment_service"),
    ("order_service", "website"),
    ("payment_service", "website"),
]


def build_graph() -> nx.DiGraph:
    """Return a fresh directed graph with the predefined services and edges."""
    g = nx.DiGraph()
    g.add_nodes_from(SERVICES)
    g.add_edges_from(DEPENDENCIES)
    return g


def get_downstream_dependents(graph: nx.DiGraph, service: str) -> list[str]:
    """Return all services that (transitively) depend on *service*.

    Uses BFS along out-edges (successors) because an edge A → B means
    B depends on A, so successors of A are its direct dependents.
    """
    if service not in graph:
        return []
    return list(nx.descendants(graph, service))


def recovery_order(graph: nx.DiGraph, service: str) -> list[str]:
    """Compute a valid recovery order for *service* and its downstream
    dependents, respecting dependency ordering.

    The returned list starts with the deepest dependency (the failed service
    itself, since it must be restored first) and ends with the leaf
    dependents.
    """
    if service not in graph:
        return [service]

    affected = {service} | set(get_downstream_dependents(graph, service))
    subgraph = graph.subgraph(affected)

    # Detect cycles (should not happen with our static data, but validates
    # dynamically-added edges).
    if not nx.is_directed_acyclic_graph(subgraph):
        raise ValueError(
            f"Cycle detected in dependency subgraph for '{service}': "
            f"{list(nx.simple_cycles(subgraph))}"
        )

    # Topological sort gives upstream-first ordering – exactly the order
    # in which services should be recovered.
    return list(nx.topological_sort(subgraph))


def get_prerequisites(graph: nx.DiGraph, service: str) -> list[str]:
    """Return all direct upstream dependencies that *service* depends on.

    Since edge A → B means B depends on A, predecessors of B are the
    services that must be healthy before B can recover.
    """
    if service not in graph:
        return []
    return list(graph.predecessors(service))


def detect_cycles(graph: nx.DiGraph) -> list[list[str]]:
    """Return all simple cycles in the graph, if any."""
    return list(nx.simple_cycles(graph))


