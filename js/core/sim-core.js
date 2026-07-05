import { SIM_PROFILES, LAB_PRESETS, PR, LAB_STATE } from "./constants.js";
import { N } from "./state.js";
import { clamp, edgeKey } from "./utils.js";
import { firewallNode, hostNodes, sourcePool, nodeById, bfs, edgeByNodes, edgePreset } from "./network.js";

/**
 * Get the current simulation profile settings.
 * @param {object} state - Global lab state
 * @returns {object} Profile settings object
 */
export function currentProfile() {
  return SIM_PROFILES[LAB_STATE.profile] || SIM_PROFILES.normal;
}

/**
 * Get a human-readable label for a traffic flow.
 * @param {object} flow - Traffic flow object
 * @returns {string} Human-readable label
 */
export function trafficLabel(flow) {
  return flow.label || LAB_PRESETS[flow.kind]?.label || flow.kind || "Traffic";
}

/**
 * Add a new traffic flow to the lab state.
 * @param {object} state - Global lab state
 * @param {object} flow - Flow to add with src, dst, kind, protocol properties
 * @returns {object} Updated lab state
 */
export function addFlow(flow) {
  LAB_STATE.flows.push({ ...flow, id: flow.id || `flow-${Date.now()}-${Math.floor(Math.random() * 1000)}`, tokens: 0, active: true, started: performance.now() });
  return LAB_STATE.flows[LAB_STATE.flows.length - 1];
}

/**
 * Pick source and destination endpoints for a given traffic kind based on available network nodes.
 * @param {object} state - Global lab state
 * @param {string} kind - Traffic kind (web, mail, db, etc.)
 * @returns {{src: string, dst: string}|null} Source and destination node IDs or null
 */
export function pickScenarioEndPoints(kind) {
  const hosts = hostNodes();
  const servers = N.nodes.filter(n => ["server", "web", "lb", "dns"].includes(n.type));
  const firewalls = N.nodes.filter(firewallNode);
  const internet = N.nodes.filter(n => n.type === "cloud");
  const firstHost = hosts[0] || N.nodes[0];
  const secondHost = hosts.find(n => n.id !== firstHost?.id) || hosts[1] || firstHost;
  const server = servers[0] || secondHost || firstHost;
  const fw = firewalls[0] || server;
  const wan = internet[0] || fw;
  if (kind === "voip" || kind === "stream") return { src: firstHost, dst: secondHost || server };
  if (kind === "dos") return { src: firstHost, dst: server || fw };
  if (kind === "ddos" || kind === "syn" || kind === "dnsamp") return { src: wan, dst: server || fw };
  return { src: firstHost, dst: server || secondHost };
}

/**
 * Determine whether a firewall node allows a packet through based on attack type, load, and profile.
 * @param {object} fw - Firewall node object
 * @param {string} atk - Attack type
 * @param {number} load - Current firewall load
 * @param {object} profile - Profile settings
 * @returns {boolean} True if packet is allowed
 */
export function firewallVerdict(node, pkt) {
  if (!firewallNode(node)) return true;
  if (!pkt.attack && pkt.kind !== "dos" && pkt.kind !== "ddos" && pkt.kind !== "syn-flood" && pkt.kind !== "dns-amplification") return true;
  const strict = node.type === "ngfw";
  const profile = currentProfile();
  const attackBias = pkt.kind === "ddos" ? 0.52 : pkt.kind === "syn-flood" ? 0.36 : pkt.kind === "dns-amplification" ? 0.4 : 0.28;
  const loadBias = clamp((pkt.edgeLoad || 0) / 12, 0, 0.42);
  const profileBias = profile.loss > 0.03 ? 0.08 : 0;
  const threshold = strict ? 0.84 : 0.64;
  const score = threshold - (attackBias + loadBias + profileBias) + (Math.random() * 0.18);
  return score > 0.18;
}

/**
 * Compute effective bandwidth, latency, and loss for an edge given the current simulation profile.
 * @param {object} edge - Edge object
 * @param {object} profile - Profile settings
 * @returns {{bw: number, lat: number, loss: number}} Computed metrics
 */
export function edgeMetrics(edge) {
  const preset = edgePreset(edge?.type || "ethernet");
  const profile = currentProfile();
  const bw = Math.max(8, (edge?.bw || preset.bw) * profile.bwScale * (edge?.type === "wifi24" ? 0.8 : edge?.type === "wifi5" ? 0.95 : 1));
  const lat = Math.max(1, (edge?.lat || preset.lat) + profile.latAdd + (edge?.type === "wifi24" ? 12 : edge?.type === "wifi5" ? 5 : 0));
  const loss = clamp((edge?.loss ?? preset.loss ?? 0) + profile.loss + (edge?.type === "wifi24" ? 0.04 : edge?.type === "wifi5" ? 0.02 : 0), 0, 0.95);
  return { bw, lat, loss };
}

/**
 * Track cumulative pressure metrics for an edge (packet count, bytes, attack count).
 * @param {object} edge - Edge object
 * @returns {object} Edge with updated pressure counters
 */
export function edgePressure(map, edge, pkt) {
  const k = edgeKey(edge.s, edge.t);
  const info = map.get(k) || { count: 0, bytes: 0, attack: 0 };
  info.count++;
  info.bytes += pkt.size || 900;
  if (pkt.attack) info.attack++;
  map.set(k, info);
  return info;
}

/**
 * Compute per-packet movement factor including step speed, loss chance, load, and jitter.
 * @param {object} state - Global lab state
 * @returns {{step: number, loss: number, jitter: number}} Movement factor components
 */
export function packetMoveFactor(edge, pressure, pkt) {
  const q = edgeMetrics(edge);
  const capacity = Math.max(1, q.bw * 0.18);
  const load = Math.max(0, pressure.bytes / capacity - 1);
  const jitter = (Math.random() * q.lat * 0.12) + (pkt.kind === "voip" ? Math.random() * 1.4 : 0);
  const duplexPenalty = (edge?.duplex === "half" && pressure.count > 1) ? 0.28 : 0;
  const sizePenalty = clamp((pkt.size || 900) / 1400, 0.35, 1.35);
  const base = 0.22 + q.bw / 25000;
  const slow = (1 + q.lat / 22 + load * 0.85 + duplexPenalty + jitter / 60) * sizePenalty;
  return { step: base / slow, loss: q.loss, load, jitterMs: jitter, metrics: q };
}

/**
 * Spawn a single protocol packet between two nodes.
 * @param {object} state - Global lab state
 * @param {string} src - Source node ID
 * @param {string} dst - Destination node ID
 * @param {object} [overrides] - Optional packet property overrides
 * @returns {object} Updated state with new packet
 */
export function spawn(s, t, proto) {
  const p = bfs(s, t);
  if (!p || p.length < 2) return;
  N.pkts.push({ id: `pk${N.pktId++}`, path: p, seg: 0, t: 0, proto, c: PR[proto]?.c || "#fff" });
  N.ppsCount++;
}

/**
 * Spawn a packet from a configured traffic flow.
 * @param {object} state - Global lab state
 * @param {object} flow - Traffic flow object
 * @returns {object} Updated state with new packet
 */
export function spawnFlowPacket(flow) {
  const src = flow.distributed && flow.sourcePool?.length ? flow.sourcePool[Math.floor(Math.random() * flow.sourcePool.length)] : nodeById(flow.srcId);
  const dst = nodeById(flow.dstId);
  if (!src || !dst || src.id === dst.id) return;
  const p = bfs(src.id, dst.id);
  if (!p || p.length < 2) return;
  N.pkts.push({ id: `pk${N.pktId++}`, path: p, seg: 0, t: 0, proto: flow.proto, c: flow.color, size: flow.size, kind: flow.kind, attack: flow.attack, flowId: flow.id, ttl: flow.ttl, label: flow.label, source: src.id, target: dst.id, age: 0, delay: 0 });
  N.ppsCount++;
}

/**
 * Spawn packets for all active lab flows based on token-bucket rate limiting.
 * @param {object} state - Global lab state
 * @returns {object} Updated state
 */
export function spawnLabTraffic(dt) {
  for (const flow of LAB_STATE.flows) {
    if (!flow.active) continue;
    flow.tokens += (flow.rate * dt * N.speed);
    const burstCap = Math.max(1, flow.burst || 1);
    let launched = 0;
    while (flow.tokens >= 1 && launched < burstCap) {
      spawnFlowPacket(flow);
      flow.tokens -= 1;
      launched++;
    }
  }
}
