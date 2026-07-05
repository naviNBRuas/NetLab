import { LINK_PRESETS } from "./constants.js";
import { N } from "./state.js";

/**
 * Infer the link type between two nodes based on their types and an optional label.
 * @param {object} na - First node
 * @param {object} nb - Second node
 * @param {string} [label] - Optional link label hint
 * @returns {string} Inferred link type key
 */
export function inferLinkType(a, b, label = "") {
  const text = `${label} ${a?.type || ""} ${b?.type || ""}`.toLowerCase();
  if (/2\.4|wifi24|wireless|ap/.test(text)) return "wifi24";
  if (/5ghz|wifi5/.test(text)) return "wifi5";
  if (/dns/.test(text)) return "dns";
  if (/vpn|ipsec/.test(text)) return "vpn";
  if (/mpls|wan|internet|pppoe|cloud/.test(text)) return "wan";
  if (/trunk|lacp|vlan/.test(text)) return "trunk";
  if (/fiber|10g|25g|40g|gig|uplink|backbone|spine|leaf/.test(text)) return "fiber";
  if (a?.type === "cloud" || b?.type === "cloud") return "wan";
  if (a?.type === "ap" || b?.type === "ap") return "wifi24";
  if (a?.type === "dns" || b?.type === "dns") return "dns";
  if (a?.type === "switch" || b?.type === "switch" || a?.type === "l3sw" || b?.type === "l3sw") return "trunk";
  return "ethernet";
}

/**
 * Look up the link preset configuration for a given link type.
 * @param {string} t - Link type key
 * @returns {object|undefined} Preset config or undefined
 */
export function edgePreset(type) {
  return LINK_PRESETS[type] || LINK_PRESETS.ethernet;
}

/**
 * Normalize an edge object by inferring type and filling in preset defaults.
 * @param {object} edge - Raw edge object
 * @param {object} state - Global lab state
 * @returns {object} Normalized edge
 */
export function normalizeEdge(e, a, b) {
  const type = e.type && LINK_PRESETS[e.type] ? e.type : inferLinkType(a, b, e.l || e.label || "");
  const p = edgePreset(type);
  const label = e.label || e.l || p.label;
  return { ...e, type, label, l: label, bw: e.bw ?? p.bw, lat: e.lat ?? p.lat, medium: e.medium || p.medium, duplex: e.duplex || p.duplex, color: e.color || p.c, dash: e.dash || p.dash, stroke: e.stroke || p.stroke };
}

/**
 * Create a new edge object between two node IDs with a specified or inferred type.
 * @param {string} a - Source node ID
 * @param {string} b - Target node ID
 * @param {object} state - Global lab state
 * @param {string} [type] - Optional explicit link type
 * @returns {object} New edge object
 */
export function createEdge(s, t, type) {
  const a = N.nodes.find(n => n.id === s), b = N.nodes.find(n => n.id === t);
  const actual = type === "auto" ? inferLinkType(a, b) : type;
  const p = edgePreset(actual);
  return { id: `e${Date.now()}${Math.floor(Math.random() * 1000)}`, s, t, type: actual, label: p.label, l: p.label, bw: p.bw, lat: p.lat, medium: p.medium, duplex: p.duplex, color: p.c, dash: p.dash, stroke: p.stroke };
}

/**
 * Find a node by its ID in the global state.
 * @param {object} state - Global lab state
 * @param {string} id - Node ID
 * @returns {object|undefined} Node object or undefined
 */
export function nodeById(id) {
  return N.nodes.find(n => n.id === id);
}

/**
 * Find an edge connecting two nodes by their IDs.
 * @param {object} state - Global lab state
 * @param {string} a - First node ID
 * @param {string} b - Second node ID
 * @returns {object|undefined} Edge object or undefined
 */
export function edgeByNodes(a, b) {
  return N.edges.find(e => (e.s === a && e.t === b) || (e.s === b && e.t === a));
}

/**
 * Check whether a node is a firewall or NGFW type.
 * @param {object} n - Node object
 * @returns {boolean} True if firewall type
 */
export function firewallNode(n) {
  return n && (n.type === "firewall" || n.type === "ngfw");
}

/**
 * Get all host-type nodes (pc, laptop, server, web, lb, dns) from the global state.
 * @param {object} state - Global lab state
 * @returns {object[]} Array of host node objects
 */
export function hostNodes() {
  return N.nodes.filter(n => ["pc", "laptop", "server", "web", "lb", "dns"].includes(n.type));
}

/**
 * Get all host nodes excluding a given ID, for use as distributed traffic sources.
 * @param {object} state - Global lab state
 * @param {string} excludeId - Node ID to exclude
 * @returns {object[]} Array of eligible source nodes
 */
export function sourcePool(excludeId) {
  return hostNodes().filter(n => n.id !== excludeId);
}

/**
 * Breadth-first search between two node IDs to find the shortest path.
 * @param {object} state - Global lab state
 * @param {string} src - Source node ID
 * @param {string} dst - Target node ID
 * @returns {string[]|null} Array of node IDs forming the path, or null
 */
export function bfs(s, t) {
  const adj = {};
  N.nodes.forEach(n => { adj[n.id] = []; });
  N.edges.forEach(e => { adj[e.s]?.push(e.t); adj[e.t]?.push(e.s); });
  const vis = new Set([s]);
  const q = [[s, [s]]];
  while (q.length) {
    const [c, p] = q.shift();
    if (c === t) return p;
    for (const nb of (adj[c] || [])) {
      if (!vis.has(nb)) { vis.add(nb); q.push([nb, [...p, nb]]); }
    }
  }
  return null;
}
