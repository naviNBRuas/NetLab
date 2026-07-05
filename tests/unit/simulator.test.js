import { describe, it, expect, beforeEach } from 'vitest';

let mod, nodes, edges, pkts, LAB_STATE;

beforeEach(() => {
  mod = undefined;
  nodes = undefined;
  edges = undefined;
  pkts = undefined;
  LAB_STATE = undefined;
});

async function load() {
  if (!mod) {
    mod = await import('../../js/index.js');
    nodes = mod.nodes;
    edges = mod.edges;
    pkts = mod.pkts;
    LAB_STATE = mod.LAB_STATE;
  }
  nodes.length = 0;
  edges.length = 0;
  pkts.length = 0;
  LAB_STATE.locked = false;
  LAB_STATE.t = 0;
  LAB_STATE.flows = [];
  LAB_STATE.blocked = 0;
  LAB_STATE.totalDrops = 0;
  LAB_STATE.pps = 0;
  return mod;
}

describe('clamp', () => {
  it('clamps value within range', async () => {
    const m = await load();
    expect(m.clamp(5, 1, 10)).toBe(5);
    expect(m.clamp(0, 1, 10)).toBe(1);
    expect(m.clamp(15, 1, 10)).toBe(10);
    expect(m.clamp(-5, -1, 1)).toBe(-1);
  });
});

describe('calcSubnet', () => {
  it('computes /24 subnet', async () => {
    const m = await load();
    const r = m.calcSubnet('192.168.1.0', 24);
    expect(r.network).toBe('192.168.1.0/24');
    expect(r.mask).toBe('255.255.255.0');
    expect(r.broadcast).toBe('192.168.1.255');
    expect(r.firstHost).toBe('192.168.1.1');
    expect(r.lastHost).toBe('192.168.1.254');
    expect(r.usableHosts).toBe(254);
  });

  it('computes /31 subnet (no broadcast)', async () => {
    const m = await load();
    const r = m.calcSubnet('10.0.0.0', 31);
    expect(r.network).toBe('10.0.0.0/31');
    expect(r.usableHosts).toBe(2);
    expect(r.firstHost).toBe('10.0.0.0');
    expect(r.lastHost).toBe('10.0.0.1');
  });

  it('computes /32 (single host)', async () => {
    const m = await load();
    const r = m.calcSubnet('172.16.0.5', 32);
    expect(r.network).toBe('172.16.0.5/32');
    expect(r.usableHosts).toBe(1);
    expect(r.firstHost).toBe('172.16.0.5');
    expect(r.lastHost).toBe('172.16.0.5');
  });

  it('computes /0 (full range)', async () => {
    const m = await load();
    const r = m.calcSubnet('0.0.0.0', 0);
    expect(r.network).toBe('0.0.0.0/0');
    expect(r.mask).toBe('0.0.0.0');
    expect(r.usableHosts).toBe(4294967294);
  });

  it('returns null for invalid input', async () => {
    const m = await load();
    expect(m.calcSubnet('', 24)).toBeNull();
    expect(m.calcSubnet('not-an-ip', 24)).toBeNull();
    expect(m.calcSubnet('192.168.1.0', -1)).toBeNull();
    expect(m.calcSubnet('192.168.1.0', 33)).toBeNull();
    expect(m.calcSubnet('256.1.1.1', 24)).toBeNull();
    expect(m.calcSubnet('1.2.3.4.5', 24)).toBeNull();
    expect(m.calcSubnet('192.168.1.0', NaN)).toBeNull();
  });
});

describe('firewallNode', () => {
  it('detects firewall nodes by type', async () => {
    const m = await load();
    expect(m.firewallNode({ type: 'firewall' })).toBe(true);
    expect(m.firewallNode({ type: 'router' })).toBe(false);
    expect(m.firewallNode({ type: 'switch' })).toBe(false);
    expect(m.firewallNode({})).toBe(false);
  });
});

describe('edgeKey', () => {
  it('generates deterministic sorted key', async () => {
    const m = await load();
    expect(m.edgeKey('a', 'b')).toBe('a|b');
    expect(m.edgeKey('b', 'a')).toBe('a|b');
    expect(m.edgeKey('x', 'y')).toBe('x|y');
  });
});

describe('edgePreset', () => {
  it('returns preset for known types', async () => {
    const m = await load();
    const eth = m.edgePreset('ethernet');
    expect(eth).toBeTruthy();
    expect(eth.bw).toBe(1000);
    expect(eth.label).toBe('Ethernet');
    const wifi = m.edgePreset('wifi24');
    expect(wifi).toBeTruthy();
    expect(wifi.label).toBe('2.4GHz Wi\u2011Fi');
  });

  it('returns default for unknown type', async () => {
    const m = await load();
    const d = m.edgePreset('unknown_type_xyz');
    expect(d).toBeTruthy();
    expect(d.label).toBe('Ethernet');
    expect(d.bw).toBe(1000);
  });
});

describe('inferLinkType', () => {
  it('infers based on node types', async () => {
    const m = await load();
    expect(m.inferLinkType({ type: 'router' }, { type: 'router' })).toBe('ethernet');
    expect(m.inferLinkType({ type: 'ap' }, { type: 'laptop' })).toBe('wifi24');
    expect(m.inferLinkType({ type: 'pc' }, { type: 'pc' })).toBe('ethernet');
  });
});

describe('normalizeEdge', () => {
  it('normalizes edge with default values', async () => {
    const m = await load();
    const e = m.normalizeEdge({ s: 'a', t: 'b' });
    expect(e.s).toBe('a');
    expect(e.t).toBe('b');
    expect(e.type).toBe('ethernet');
    expect(e.bw).toBe(1000);
    expect(e.lat).toBe(2);
  });

  it('preserves custom values', async () => {
    const m = await load();
    const a = { type: 'ap', id: 'a' };
    const b = { type: 'laptop', id: 'b' };
    const e = m.normalizeEdge({ s: 'a', t: 'b', type: 'wifi24', bw: 600, lat: 5, loss: 0.01 }, a, b);
    expect(e.type).toBe('wifi24');
    expect(e.bw).toBe(600);
    expect(e.lat).toBe(5);
    expect(e.loss).toBe(0.01);
  });
});

describe('bfs', () => {
  it('finds path between directly connected nodes', async () => {
    const m = await load();
    nodes.push({ id: 'a' }, { id: 'b' });
    edges.push({ s: 'a', t: 'b' });
    expect(m.bfs('a', 'b')).toEqual(['a', 'b']);
  });

  it('finds multi-hop path', async () => {
    const m = await load();
    nodes.push({ id: 'a' }, { id: 'b' }, { id: 'c' });
    edges.push({ s: 'a', t: 'b' }, { s: 'b', t: 'c' });
    expect(m.bfs('a', 'c')).toEqual(['a', 'b', 'c']);
  });

  it('returns null when no path exists', async () => {
    const m = await load();
    nodes.push({ id: 'a' }, { id: 'b' }, { id: 'c' });
    edges.push({ s: 'a', t: 'b' });
    expect(m.bfs('a', 'c')).toBeNull();
  });

  it('finds shortest path in mesh', async () => {
    const m = await load();
    nodes.push({ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' });
    edges.push({ s: 'a', t: 'b' }, { s: 'b', t: 'c' }, { s: 'c', t: 'd' }, { s: 'a', t: 'c' }, { s: 'a', t: 'd' });
    expect(m.bfs('a', 'd').length).toBeLessThanOrEqual(2);
  });

  it('returns single node path for same source and target', async () => {
    const m = await load();
    nodes.push({ id: 'a' });
    expect(m.bfs('a', 'a')).toEqual(['a']);
  });

  it('returns null when source not in graph', async () => {
    const m = await load();
    nodes.push({ id: 'a' });
    expect(m.bfs('nonexistent', 'a')).toBeNull();
  });
});

describe('firewallVerdict', () => {
  it('allows non-firewall passthrough', async () => {
    const m = await load();
    const pkt = { src: 'pc1', dst: 'srv', proto: 'TCP', size: 100 };
    const result = m.firewallVerdict(pkt);
    expect(result).toBe(true);
  });

  it('allows normal traffic through firewall', async () => {
    const m = await load();
    const fwNode = { id: 'fw', type: 'firewall' };
    const pkt = { src: 'pc1', dst: 'srv', proto: 'TCP', size: 100, attack: false, kind: 'web' };
    const v = m.firewallVerdict(fwNode, pkt);
    expect(v).toBe(true);
  });

  it('processes attack traffic through firewall (returns boolean)', async () => {
    const m = await load();
    const fwNode = { id: 'fw', type: 'firewall' };
    const pkt = { src: 'pc1', dst: 'srv', proto: 'TCP', size: 100, kind: 'dos', attack: true, edgeLoad: 0 };
    const v = m.firewallVerdict(fwNode, pkt);
    expect(typeof v).toBe('boolean');
  });

  it('returns true for ngfw with non-attack traffic', async () => {
    const m = await load();
    const fwNode = { id: 'fw', type: 'ngfw' };
    const pkt = { src: 'pc1', dst: 'srv', proto: 'TCP', size: 100, kind: 'web', attack: false };
    const v = m.firewallVerdict(fwNode, pkt);
    expect(v).toBe(true);
  });
});

describe('edgeMetrics', () => {
  it('returns computed {bw, lat, loss} for ethernet on balanced profile', async () => {
    const m = await load();
    const preset = m.edgePreset('ethernet');
    const edge = { type: 'ethernet', bw: preset.bw, lat: preset.lat, loss: 0 };
    const mt = m.edgeMetrics(edge);
    expect(mt).toHaveProperty('bw');
    expect(mt).toHaveProperty('lat');
    expect(mt).toHaveProperty('loss');
    expect(typeof mt.bw).toBe('number');
    expect(typeof mt.lat).toBe('number');
    expect(mt.lat).toBeGreaterThan(0);
    expect(mt.bw).toBeGreaterThanOrEqual(8);
  });

  it('applies wifi24 modifier for higher latency', async () => {
    const m = await load();
    const preset = m.edgePreset('wifi24');
    const wifi = m.edgeMetrics({ type: 'wifi24', bw: preset.bw, lat: preset.lat, loss: 0 });
    expect(wifi.lat).toBeGreaterThan(8);
    expect(wifi.bw).toBeLessThan(600);
  });
});

describe('edgePressure', () => {
  it('accumulates count and bytes in a map', async () => {
    const m = await load();
    const map = new Map();
    const edge = { s: 'a', t: 'b' };
    const pkt = { size: 500 };
    const info = m.edgePressure(map, edge, pkt);
    expect(info.count).toBe(1);
    expect(info.bytes).toBe(500);
    expect(info.attack).toBe(0);
  });

  it('increases with multiple packets', async () => {
    const m = await load();
    const map = new Map();
    const edge = { s: 'a', t: 'b' };
    const pkt = { size: 500 };
    m.edgePressure(map, edge, pkt);
    const info = m.edgePressure(map, edge, pkt);
    expect(info.count).toBe(2);
    expect(info.bytes).toBe(1000);
  });

  it('tracks attack packets separately', async () => {
    const m = await load();
    const map = new Map();
    const edge = { s: 'a', t: 'b' };
    const pkt = { size: 300, attack: true };
    const info = m.edgePressure(map, edge, pkt);
    expect(info.attack).toBe(1);
  });
});

describe('packetMoveFactor', () => {
  it('returns object with step, loss, load for healthy link', async () => {
    const m = await load();
    const edge = { s: 'a', t: 'b', type: 'ethernet', bw: 1000, lat: 2, loss: 0, duplex: 'full' };
    const pressure = { count: 1, bytes: 900, attack: 0 };
    const pkt = { size: 900, kind: 'web' };
    const f = m.packetMoveFactor(edge, pressure, pkt);
    expect(f).toHaveProperty('step');
    expect(f).toHaveProperty('loss');
    expect(f).toHaveProperty('load');
    expect(f.step).toBeGreaterThan(0);
    expect(typeof f.step).toBe('number');
  });

  it('returns lower step for degraded link', async () => {
    const m = await load();
    const edge = { s: 'x', t: 'y', type: 'wifi24', bw: 150, lat: 20, loss: 0.06, duplex: 'half' };
    const pressure = { count: 10, bytes: 50000, attack: 0 };
    const pkt = { size: 1400, kind: 'stream' };
    const healthy = m.packetMoveFactor(
      { s: 'a', t: 'b', type: 'ethernet', bw: 1000, lat: 2, loss: 0, duplex: 'full' },
      { count: 1, bytes: 900, attack: 0 },
      { size: 900, kind: 'web' },
    );
    const degraded = m.packetMoveFactor(edge, pressure, pkt);
    expect(degraded.step).toBeLessThan(healthy.step);
  });
});
