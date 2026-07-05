/* NetLab v1.0.0 — ESM Entry Point */

import { D, PR, OSI_DATA, DEVINFO, LINK_PRESETS, LINK_CHOICES, SIM_PROFILES, LAB_PRESETS, SCENARIOS, ROUTING_TABLES, VLANS, TCP_STEPS, LAB_STATE } from './core/constants.js';
import { N } from './core/state.js';
import { clamp, calcSubnet, edgeKey, sidebarBounds, readStoredWidth, applySidebarWidths, initSidebarWidths } from './core/utils.js';
import { inferLinkType, edgePreset, normalizeEdge, createEdge, nodeById, edgeByNodes, firewallNode, hostNodes, sourcePool, bfs } from './core/network.js';
import { currentProfile, trafficLabel, addFlow, pickScenarioEndPoints, firewallVerdict as pureFirewallVerdict, edgeMetrics, edgePressure, packetMoveFactor, spawn, spawnFlowPacket, spawnLabTraffic } from './core/sim-core.js';

/* ── State (DOM-dependent) ── */
let selN = null, selE = null, addMode = null, connMode = false, connStart = null;
let drag = null, doff = { x: 0, y: 0 };
let running = true, lastSpawn = 0, pps = 0, lastPps = 0;
let activeTab = "info", activeSc = "home";
let selProto = "ICMP";
let resizeMode = null;
let resizeStartX = 0, resizeStartLeft = 0, resizeStartRight = 0;

/* ── DOM refs (guarded) ── */
const svg = typeof document !== 'undefined' ? document.getElementById("ns") : null;
const el = typeof document !== 'undefined' ? document.getElementById("el") : null;
const pl = typeof document !== 'undefined' ? document.getElementById("pl") : null;
const nl = typeof document !== 'undefined' ? document.getElementById("nl") : null;

const LEFT_KEY = "netlab.sidebar.left";
const RIGHT_KEY = "netlab.sidebar.right";

/* ── Shared state aliases (for test compatibility) ── */
const nodes = N.nodes;
const edges = N.edges;
const pkts = N.pkts;

/* ── Helpers ── */

function svgPt(e) {
  const r = svg.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (820 / r.width), y: (e.clientY - r.top) * (580 / r.height) };
}

function mkSVG(tag, a) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(a)) e.setAttribute(k, v);
  return e;
}

/* ── Resize ── */

function beginResize(side, e) {
  resizeMode = side;
  resizeStartX = e.clientX;
  resizeStartLeft = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--left-w")) || 148;
  resizeStartRight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--right-w")) || 286;
  document.body.style.userSelect = "none";
  document.body.style.cursor = "col-resize";
}

function moveResize(e) {
  if (!resizeMode) return;
  const dx = e.clientX - resizeStartX;
  const b = sidebarBounds();
  if (resizeMode === "left") {
    const left = clamp(resizeStartLeft + dx, b.leftMin, b.leftMax);
    applySidebarWidths(left, parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--right-w")) || resizeStartRight);
  } else if (resizeMode === "right") {
    const right = clamp(resizeStartRight - dx, b.rightMin, b.rightMax);
    applySidebarWidths(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--left-w")) || resizeStartLeft, right);
  }
}

function endResize() {
  if (!resizeMode) return;
  resizeMode = null;
  document.body.style.userSelect = "";
  document.body.style.cursor = "";
}

/* ── Logging ── */

function addLog(msg, t) {
  N.logs.unshift({ msg, t, time: new Date().toLocaleTimeString() });
  if (N.logs.length > 80) N.logs.pop();
  if (activeTab === "log") renderRight();
}

/* ── Rendering ── */

function renderEdges() {
  el.innerHTML = "";
  const vpnIds = SCENARIOS[activeSc]?.vpn || [];
  for (const e of edges) {
    const s = nodes.find(n => n.id === e.s), t = nodes.find(n => n.id === e.t);
    if (!s || !t) continue;
    const p = edgePreset(e.type || inferLinkType(s, t, e.l));
    const isSel = selE === e.id, isVPN = vpnIds.includes(e.s) && vpnIds.includes(e.t), isBlk = e.l?.includes("[BLK]");
    const active = pkts.some(p => { const a = p.path[p.seg], b = p.path[p.seg + 1]; return (a === e.s && b === e.t) || (a === e.t && b === e.s); });
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.style.cursor = "pointer";
    const stroke = e.color || p.c;
    const dash = e.dash || p.dash || (isVPN && e.type !== "vpn" ? "7 3" : "none");
    const width = e.stroke || p.stroke || 1.7;
    const hit = mkSVG("line", { x1: s.x, y1: s.y, x2: t.x, y2: t.y, stroke: "rgba(0,0,0,0)", "stroke-width": 14, "pointer-events": "stroke" });
    const line = mkSVG("line", {
      x1: s.x, y1: s.y, x2: t.x, y2: t.y,
      stroke: isSel ? "#00ddff" : isBlk ? "#ff4455" : active ? "#bfeaff" : stroke,
      "stroke-width": isSel ? Math.max(2.8, width + 0.4) : width,
      "stroke-dasharray": isBlk ? "4 4" : dash,
      opacity: isBlk ? 0.55 : 0.95
    });
    g.appendChild(hit);
    g.appendChild(line);
    const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;
    const lbl = e.label || e.l || p.label;
    const bg = mkSVG("rect", { x: mx - Math.max(18, lbl.length * 2.8) - 2, y: my - 8, width: Math.max(36, lbl.length * 5.6) + 4, height: 12, fill: "#060c18", rx: 1, opacity: 0.95 });
    const txt = mkSVG("text", { x: mx, y: my + 1, "text-anchor": "middle", "font-size": "7", fill: isBlk ? "#ff4455" : isVPN ? "#ffc700" : stroke, "font-family": "monospace" });
    txt.textContent = lbl;
    g.appendChild(bg);
    g.appendChild(txt);
    g.addEventListener("click", ev => { ev.stopPropagation(); selE = e.id; selN = null; render(); renderRight(); });
    el.appendChild(g);
  }
}

function renderNodes() {
  nl.innerHTML = "";
  for (const n of nodes) {
    const dev = D[n.type] || D.pc;
    const isSel = selN === n.id, isCStart = connStart === n.id;
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.style.cursor = drag === n.id ? "grabbing" : "grab";
    const ttl = mkSVG('title', {});
    ttl.textContent = n.label + (n.ip ? ' — ' + n.ip : '');
    g.appendChild(ttl);
    if (isSel || isCStart) {
      const ring = mkSVG("circle", { cx: n.x, cy: n.y, r: 30, fill: "none", stroke: isCStart ? "#00ff88" : "#00ddff", "stroke-width": 1.5, "stroke-dasharray": "5 3", opacity: 0.7 });
      g.appendChild(ring);
    }
    const circle = mkSVG("circle", { cx: n.x, cy: n.y, r: 22, fill: isSel ? "#0a1e38" : "#060c18", stroke: dev.c, "stroke-width": isSel ? 2 : 1.2, opacity: isSel ? 1 : 0.9 });
    g.appendChild(circle);
    const icon = mkSVG("text", { x: n.x, y: n.y + 5, "text-anchor": "middle", "font-size": "13", "dominant-baseline": "middle" });
    icon.style.pointerEvents = "none";
    icon.textContent = dev.i;
    g.appendChild(icon);
    const lblWidth = Math.max(60, (n.label || '').length * 6);
    const lblBg = mkSVG("rect", { x: n.x - lblWidth / 2, y: n.y + 24, width: lblWidth, height: 12, fill: '#060c18', rx: 2 });
    lblBg.style.pointerEvents = 'none';
    g.appendChild(lblBg);
    const lbl = mkSVG("text", { x: n.x, y: n.y + 34, "text-anchor": "middle", "font-size": "8", fill: isSel ? "#a8bdd4" : "#bfeaff", "font-family": "monospace" });
    lbl.style.pointerEvents = "none";
    lbl.textContent = n.label;
    g.appendChild(lbl);
    if (n.ip) {
      const ipWidth = Math.max(50, (n.ip || '').length * 6);
      const ipBg = mkSVG("rect", { x: n.x - ipWidth / 2, y: n.y + 34, width: ipWidth, height: 12, fill: '#060c18', rx: 2 });
      ipBg.style.pointerEvents = 'none';
      g.appendChild(ipBg);
      const ip = mkSVG("text", { x: n.x, y: n.y + 44, "text-anchor": "middle", "font-size": "7", fill: "#9bd0ff", "font-family": "monospace" });
      ip.style.pointerEvents = "none";
      ip.textContent = n.ip;
      g.appendChild(ip);
    }
    g.addEventListener("mousedown", ev => { ev.stopPropagation(); handleDown(ev, n.id); });
    nl.appendChild(g);
  }
}

function renderPkts() {
  pl.innerHTML = "";
  for (const p of pkts) {
    const s = nodes.find(n => n.id === p.path[p.seg]), t = nodes.find(n => n.id === p.path[p.seg + 1]);
    if (!s || !t) continue;
    const px = s.x + (t.x - s.x) * p.t, py = s.y + (t.y - s.y) * p.t;
    const outer = mkSVG("circle", { cx: px, cy: py, r: 6, fill: p.c, opacity: 0.12 });
    const inner = mkSVG("circle", { cx: px, cy: py, r: 3, fill: p.c, opacity: 0.95 });
    const lbl2 = mkSVG("text", { x: px, y: py - 7, "text-anchor": "middle", "font-size": "6", fill: p.c, "font-family": "monospace" });
    lbl2.textContent = p.proto;
    const gg = mkSVG("g", {});
    gg.classList.add('pkt');
    gg.appendChild(outer);
    gg.appendChild(inner);
    gg.appendChild(lbl2);
    pl.appendChild(gg);
  }
}

function renderHUD() {
  document.getElementById("h-pkts").textContent = `📦 ${pkts.length}`;
  document.getElementById("h-topo").textContent = `🖧 ${nodes.length}N ${edges.length}L`;
  document.getElementById("h-bw").textContent = `↑ ${pps} pps`;
  const sample = LAB_STATE.delivered + LAB_STATE.totalDrops;
  const lossNow = sample < 5 ? 0 : Math.round((LAB_STATE.totalDrops / sample) * 100);
  const avgFlow = LAB_STATE.flows.length || 0;
  const avgDelay = Math.round(pkts.reduce((a, p) => a + (p.delay || 0), 0) / Math.max(1, pkts.length));
  const hLoss = document.getElementById("h-loss");
  const hLat = document.getElementById("h-lat");
  const hLab = document.getElementById("h-lab");
  if (hLoss) hLoss.textContent = `⚠ ${lossNow}% loss`;
  if (hLat) hLat.textContent = `⏱ ${avgDelay} ms`;
  if (hLab) hLab.textContent = `🧪 ${avgFlow} flows`;
}

function render() { renderEdges(); renderNodes(); renderHUD(); }

/* ── Node interaction ── */

function handleDown(e, id) {
  if (connMode) {
    if (!connStart) { connStart = id; renderNodes(); updateHints(); return; }
    if (connStart !== id) {
      const sn = nodes.find(n => n.id === connStart), tn = nodes.find(n => n.id === id);
      const edge = createEdge(connStart, id, N.selectedLinkType);
      N.edges.push(edge);
      addLog(`🔗 ${sn?.label} ↔ ${tn?.label} (${edge.label})`, "ok");
      connStart = null;
      updateConnBtn();
      updateHints();
      render();
      renderRight();
      return;
    }
    return;
  }
  selN = id;
  selE = null;
  drag = id;
  const nd = nodes.find(n => n.id === id);
  const pt = svgPt(e);
  doff = { x: pt.x - nd.x, y: pt.y - nd.y };
  render();
  renderRight();
}

/* ── Firewall verdict (wrapper with side effects) ── */

function firewallVerdict(node, pkt) {
  const allow = pureFirewallVerdict(node, pkt);
  if (!allow) {
    LAB_STATE.blocked++;
    const now = performance.now();
    if (now - LAB_STATE.lastLogAt > 1000) {
      addLog(`🛡️ ${node.label} blocked ${pkt.kind.toUpperCase()} traffic`, "warn");
      LAB_STATE.lastLogAt = now;
    }
  }
  return allow;
}

/* ── Profile / Lab flows (DOM-dependent wrappers) ── */

function applyProfile(key, announce = true) {
  if (!SIM_PROFILES[key]) return;
  LAB_STATE.profile = key;
  if (announce) addLog(`🧪 Network profile: ${SIM_PROFILES[key].label} — ${SIM_PROFILES[key].desc}`, "info");
  renderHUD();
  renderRight();
}

function startLabFlow(kind, overrides = {}) {
  const preset = LAB_PRESETS[kind];
  if (!preset) return null;
  const endpoints = pickScenarioEndPoints(kind);
  const src = overrides.src || endpoints.src;
  const dst = overrides.dst || endpoints.dst;
  if (!src || !dst || src.id === dst.id) return null;
  const flow = {
    kind,
    label: overrides.label || preset.label,
    proto: overrides.proto || preset.proto,
    rate: overrides.rate || preset.rate,
    size: overrides.size || preset.size,
    attack: overrides.attack ?? preset.attack,
    srcId: src.id,
    dstId: dst.id,
    distributed: overrides.distributed || false,
    sourcePool: overrides.sourcePool || sourcePool(dst.id),
    ttl: overrides.ttl || 64,
    port: overrides.port || null,
    burst: overrides.burst || 1,
    color: overrides.color || PR[preset.proto]?.c || "#fff",
    meta: overrides.meta || {}
  };
  addFlow(flow);
  addLog(`▶ ${trafficLabel(flow)} ${src.label} → ${dst.label}`, (flow.attack ? "warn" : "packet"));
  return flow;
}

function stopAllLabFlows() {
  LAB_STATE.flows.length = 0;
  addLog("🛑 Lab traffic stopped", "warn");
  renderRight();
}

function loadSc(key) {
  const s = SCENARIOS[key];
  if (!s) return;
  activeSc = key;
  N.nodes.length = 0;
  N.nodes.push(...s.nodes.map(n => ({ ...n })));
  const newEdges = s.edges.map(e => normalizeEdge({ ...e }, nodeById(e.s), nodeById(e.t)));
  N.edges.length = 0;
  N.edges.push(...newEdges);
  N.pkts.length = 0;
  selN = null;
  selE = null;
  LAB_STATE.flows.length = 0;
  LAB_STATE.totalDrops = 0;
  LAB_STATE.blocked = 0;
  LAB_STATE.delivered = 0;
  LAB_STATE.lastLogAt = 0;
  addLog(`▶ ${s.name}`, "ok");
  render();
  document.querySelectorAll(".sc-btn").forEach(b => b.classList.toggle("active", b.dataset.k === key));
  renderRight();
}

/* ── Right panel ── */

function genHdrVis(proto) {
  const layers = {
    ICMP: [{ l: "IP Header", c: "#3b82f6", f: ["Ver", "IHL", "TTL", "Proto=1", "Src IP", "Dst IP"] }, { l: "ICMP", c: "#ffd700", f: ["Type(8=req,0=rep)", "Code", "Checksum", "Identifier", "Seq Number", "Data..."] }],
    TCP: [{ l: "IP Header", c: "#3b82f6", f: ["Ver", "IHL", "TTL", "Proto=6", "Src IP", "Dst IP"] }, { l: "TCP Header", c: "#00ddff", f: ["Src Port", "Dst Port", "Seq Num", "ACK Num", "Flags(SYN/ACK/FIN)", "Window", "Chk"] }, { l: "Payload", c: "#3a6080", f: ["Application Data..."] }],
    UDP: [{ l: "IP Header", c: "#3b82f6", f: ["Ver", "IHL", "TTL", "Proto=17", "Src IP", "Dst IP"] }, { l: "UDP Header", c: "#00ff88", f: ["Src Port", "Dst Port", "Length", "Checksum"] }, { l: "Payload", c: "#3a6080", f: ["Data"] }],
    HTTP: [{ l: "Ethernet", c: "#8b5cf6", f: ["Dst MAC", "Src MAC", "EtherType"] }, { l: "IP", c: "#3b82f6", f: ["Src IP", "Dst IP", "TTL"] }, { l: "TCP", c: "#00ddff", f: ["Src Port", "Dst Port=80", "Seq", "ACK"] }, { l: "HTTP", c: "#60a5fa", f: ["GET / HTTP/1.1", "Host: example.com", "Accept: text/html"] }],
    HTTPS: [{ l: "IP", c: "#3b82f6", f: ["Src IP", "Dst IP"] }, { l: "TCP", c: "#00ddff", f: ["Dst Port=443"] }, { l: "TLS", c: "#f59e0b", f: ["ContentType", "Version TLS1.3", "IV+AuthTag"] }, { l: "HTTP (enc)", c: "#34d399", f: ["[Encrypted payload]"] }],
    DNS: [{ l: "IP", c: "#3b82f6", f: ["Src IP", "Dst IP 8.8.8.8", "Proto=17"] }, { l: "UDP", c: "#00ff88", f: ["Dst Port=53"] }, { l: "DNS", c: "#a855f7", f: ["Tx ID", "Flags", "Question: A www.example.com", "Answer: 93.184.216.34"] }],
    ARP: [{ l: "Ethernet", c: "#8b5cf6", f: ["Dst FF:FF:FF:FF:FF:FF", "Src MAC", "EtherType=0x0806"] }, { l: "ARP", c: "#f472b6", f: ["op=1(Request)", "Sender MAC", "Sender IP", "Target IP"] }]
  };
  const lrs = layers[proto] || layers.TCP;
  return lrs.map(l => `<div class="hdr-layer"><div class="hdr-name" style="--lc:${l.c}">${l.l}</div><div class="hdr-fields">${l.f.map(f => `<div class="hdr-f" style="--lc:${l.c}">${f}</div>`).join("")}</div></div>`).join("");
}

function renderRight() {
  const rc = document.getElementById("rc");
  if (activeTab === "info") rc.innerHTML = renderInfo();
  else if (activeTab === "pkt") rc.innerHTML = renderPkt();
  else if (activeTab === "osi") rc.innerHTML = renderOsi();
  else if (activeTab === "tcp") rc.innerHTML = renderTCP();
  else if (activeTab === "tools") rc.innerHTML = renderTools();
  else if (activeTab === "vlan") rc.innerHTML = renderVLAN();
  else if (activeTab === "route") rc.innerHTML = renderRoute();
  else if (activeTab === "log") rc.innerHTML = renderLog();
  bindRight();
}

function renderInfo() {
  const sn = nodes.find(n => n.id === selN);
  const se = edges.find(e => e.id === selE);
  if (sn) {
    const dev = D[sn.type] || D.pc;
    const prHTML = Object.entries(PR).map(([k, v]) => `<button class="pb${selProto === k ? " active" : ""}" style="--pc:${v.c}" data-p="${k}">${k}</button>`).join("");
    return `<span class="field">NODE INSPECTOR</span>
      <div class="icard"><div class="iico">${dev.i}</div><div class="iname">${sn.label}</div>
      <div class="isub">${dev.l}</div>${sn.ip ? `<div class="isub">${sn.ip}</div>` : ""}</div>
      <span class="field">SEND PACKET</span>
      <div class="pbrow">${prHTML}</div>
      <button class="sbtn" id="spkt">▶ Send ${selProto}</button>
      <button class="sbtn2" id="bcast">⟳ Broadcast Burst</button>
      <div class="lbox"><div class="ltitle">HOW THIS WORKS</div>
      <div class="ltext">${DEVINFO[sn.type] || "Select a node to learn about it."}</div></div>`;
  }
  if (se) {
    const sn2 = nodes.find(n => n.id === se.s), tn = nodes.find(n => n.id === se.t);
    const lp = edgePreset(se.type || inferLinkType(sn2, tn, se.l));
    const opts = LINK_CHOICES.map(k => `<option value="${k}" ${((se.type || "auto") === k) ? "selected" : ""}>${edgePreset(k).label}${k === "auto" ? " (smart)" : ""}</option>`).join("");
    return `<span class="field">LINK INSPECTOR</span>
      <div class="icard"><div class="iico">🔗</div><div class="iname">${se.label || se.l || lp.label}</div>
      <div class="isub">${sn2?.label || se.s} ↔ ${tn?.label || se.t}</div>
      <div class="isub" style="color:${lp.c};margin-top:3px">${lp.label} • ${lp.medium}</div></div>
      <div class="tool-section">
        <div class="ltitle">LINK SETTINGS</div>
        <div class="tool-row"><span class="tool-lbl">Type</span><select class="tool-input" id="lk-type">${opts}</select></div>
        <div class="tool-row"><span class="tool-lbl">Label</span><input class="tool-input" id="lk-label" value="${se.label || se.l || lp.label}"></div>
        <div class="tool-row"><span class="tool-lbl">BW</span><input class="tool-input" id="lk-bw" type="number" min="1" value="${se.bw || lp.bw}"><span class="tool-lbl" style="min-width:auto">Mbps</span></div>
        <div class="tool-row"><span class="tool-lbl">Latency</span><input class="tool-input" id="lk-lat" type="number" min="0" value="${se.lat || lp.lat}"><span class="tool-lbl" style="min-width:auto">ms</span></div>
        <div class="tool-row"><span class="tool-lbl">Duplex</span><select class="tool-input" id="lk-duplex"><option value="full" ${((se.duplex || lp.duplex) === "full") ? "selected" : ""}>Full</option><option value="half" ${((se.duplex || lp.duplex) === "half") ? "selected" : ""}>Half</option></select></div>
        <button class="sbtn" id="lk-apply">Apply Link Settings</button>
        <button class="sbtn2" id="lk-del">Unlink</button>
      </div>
      <div class="lbox"><div class="ltitle">ABOUT LINKS</div>
      <div class="ltext">Links are now editable network objects with real presets: Ethernet, Fiber, Wi‑Fi, WAN, VPN, DNS service paths, and trunks. Change the preset to update bandwidth, latency, line style, and label together.</div></div>`;
  }
  const sc = SCENARIOS[activeSc];
  return `<span class="field">SCENARIO</span>
    <div class="icard"><div class="iname">${sc?.name || "Custom"}</div><div class="ltext" style="margin-top:4px">${sc?.desc || ""}</div></div>
    <div class="lbox"><div class="ltitle">GETTING STARTED</div>
    <div class="ltext">🖱 Drag nodes to rearrange<br>📍 Left panel: add devices → click canvas<br>🔗 Connect tool: wire nodes<br>📦 Auto packets flow when running<br>▶ Click node → Send any protocol<br>🔍 OSI tab: full 7-layer reference<br>🔧 TCP tab: 3-way handshake walkthrough<br>🛠 Tools tab: ping, traceroute, subnet calc</div></div>`;
}

function renderPkt() {
  return `<span class="field">PACKET DISSECTOR</span>
    <div class="pbrow">${Object.entries(PR).map(([k, v]) => `<button class="pb${selProto === k ? " active" : ""}" style="--pc:${v.c}" data-p="${k}">${k}</button>`).join("")}</div>
    <div class="hdr-vis"><div class="hdr-title">${selProto} HEADER STRUCTURE</div>${genHdrVis(selProto)}</div>
    <div class="lbox"><div class="ltitle">${selProto} EXPLAINED</div>
    <div class="ltext">${PR[selProto]?.info || ""}</div></div>
    <span class="field" style="margin-top:8px">LIVE COUNTS</span>
    ${Object.entries(PR).map(([k, v]) => { const cnt = pkts.filter(p => p.proto === k).length; return `<div class="prow"><div class="pdot" style="background:${v.c}"></div><div><div class="pkey" style="color:${v.c}">${k}</div><div class="plbl">${v.l}</div></div><div class="pcnt" style="color:${v.c}">${cnt || ""}</div></div>`; }).join("")}`;
}

function renderOsi() {
  return `<span class="field">OSI REFERENCE MODEL</span>` +
    OSI_DATA.map(l => `<div class="osi-r" style="--lc:${l.c}" onclick="this.querySelector('.osi-detail').classList.toggle('open')">
    <div class="osi-h"><span class="osi-n">L${l.n} — ${l.name}</span><span style="font-size:8px;color:${l.c}">▾</span></div>
    <div class="osi-d">${l.d}</div><div class="osi-p">${l.proto}</div>
    <div class="osi-detail"><div class="ltext">${l.detail}</div></div>
  </div>`).join("") +
    `<div class="lbox"><div class="ltitle">ENCAPSULATION</div><div class="ltext">Sender: App data → L4 adds TCP/UDP header → L3 adds IP header → L2 adds Eth frame → L1 puts bits on wire. Receiver strips headers bottom-up (decapsulation).</div></div>`;
}

function renderTCP() {
  return `<span class="field">TCP 3-WAY HANDSHAKE</span>
    ${TCP_STEPS.map((s, i) => `<div class="tcp-step" onclick="this.querySelector('.tcp-detail').classList.toggle('open')">
      <div class="tcp-step-hdr"><span style="font-size:12px">${s.from}</span><span class="tcp-flag">${s.flags}</span><span style="font-size:7px;color:#1a3a5a;margin-left:auto">[${i + 1}/${TCP_STEPS.length}]</span></div>
      <div class="tcp-desc">${s.desc}</div>
      <div class="tcp-detail">${s.detail}</div>
    </div>`).join("")}
    <div class="lbox"><div class="ltitle">TCP STATE MACHINE</div>
    <div class="ltext">CLOSED → LISTEN → SYN_RCVD → ESTABLISHED → FIN_WAIT_1 → FIN_WAIT_2 → TIME_WAIT → CLOSED (active closer). TIME_WAIT lasts 2×MSL (~60s) to prevent old duplicate segments from corrupting new connections.</div></div>`;
}

function renderTools() {
  const profileOpts = Object.entries(SIM_PROFILES).map(([k, v]) => `<option value="${k}" ${LAB_STATE.profile === k ? "selected" : ""}>${v.label}</option>`).join("");
  return `<span class="field">NETWORK TOOLS</span>
    <div class="tool-section">
      <div class="ltitle">SIMULATION LAB</div>
      <div class="tool-row"><span class="tool-lbl">Profile</span><select class="tool-input" id="lab-profile">${profileOpts}</select></div>
      <div class="tool-row"><button class="sbtn" id="lab-apply">Apply Profile</button><button class="sbtn2" id="lab-reset">Reset Lab</button></div>
      <div class="tool-row"><button class="sbtn2" id="lab-voip">VoIP</button><button class="sbtn2" id="lab-stream">Stream</button><button class="sbtn2" id="lab-web">Web</button></div>
      <div class="tool-row"><button class="sbtn2" id="lab-dos">DoS</button><button class="sbtn2" id="lab-ddos">DDoS</button><button class="sbtn2" id="lab-syn">SYN</button><button class="sbtn2" id="lab-dnsamp">DNS Amp</button></div>
      <div class="tool-row"><button class="sbtn" id="lab-stop">Stop Traffic</button></div>
      <div id="lab-out" class="tool-result">${SIM_PROFILES[LAB_STATE.profile].desc}<br>${LAB_STATE.flows.length} live flow(s), ${LAB_STATE.blocked} firewall blocks, ${LAB_STATE.totalDrops} drops.</div>
    </div>
    <div class="tool-section">
      <div class="ltitle">PING SIMULATOR</div>
      <div class="tool-row"><span class="tool-lbl">Target:</span><input id="ping-tgt" class="tool-input" value="192.168.1.1"></div>
      <button class="sbtn" id="ping-btn">▶ Ping</button><div id="ping-out"></div>
    </div>
    <div class="tool-section">
      <div class="ltitle">TRACEROUTE SIMULATOR</div>
      <div class="tool-row"><span class="tool-lbl">Target:</span><input id="tr-tgt" class="tool-input" value="8.8.8.8"></div>
      <button class="sbtn" id="tr-btn">▶ Traceroute</button><div id="tr-out"></div>
    </div>
    <div class="tool-section">
      <div class="ltitle">SUBNET CALCULATOR</div>
      <div class="tool-row"><span class="tool-lbl">Network:</span><input id="sn-ip" class="tool-input" value="192.168.1.0"></div>
      <div class="tool-row"><span class="tool-lbl">CIDR:</span><input id="sn-cidr" class="tool-input" value="24" type="number" min="0" max="32" style="width:60px"></div>
      <button class="sbtn" id="sn-btn">▶ Calculate</button><div id="sn-out"></div>
    </div>
    <div class="tool-section">
      <div class="ltitle">NSLOOKUP SIMULATOR</div>
      <div class="tool-row"><span class="tool-lbl">Domain:</span><input id="ns-q" class="tool-input" value="www.google.com"></div>
      <button class="sbtn" id="ns-btn">▶ Resolve</button><div id="ns-out"></div>
    </div>`;
}

function renderVLAN() {
  const vlans = VLANS[activeSc] || VLANS.default;
  return `<span class="field">VLAN CONFIGURATION</span>
    ${vlans.map(v => `<div class="vlan-row" style="--vc:${v.c}"><div class="vlan-id">VLAN ${v.id}</div><div><div class="vlan-name">${v.name}</div><div class="vlan-ports">${v.ports}</div></div></div>`).join("")}
    <div class="lbox"><div class="ltitle">HOW VLANs WORK</div>
    <div class="ltext">VLANs (802.1Q) logically segment a switch at Layer 2. A port is either Access (carries one VLAN, strips tag) or Trunk (carries multiple VLANs, preserves 802.1Q tags). The 4-byte tag: 2B TPID=0x8100 + 2B TCI (3b PCP + 1b DEI + 12b VLAN ID → 4094 VLANs). Inter-VLAN routing requires an L3 switch SVI or router-on-a-stick.</div></div>`;
}

function renderRoute() {
  const tbl = ROUTING_TABLES[activeSc];
  let rows = `<span class="field">ROUTING TABLE</span>`;
  if (tbl) {
    rows += `<div style="overflow-x:auto"><table class="rt-table"><thead><tr><th>DESTINATION</th><th>NEXT HOP</th><th>PROTO</th><th>AD</th></tr></thead><tbody>`;
    tbl.forEach(r => { rows += `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`; });
    rows += `</tbody></table></div>`;
  }
  rows += `<div class="lbox"><div class="ltitle">ROUTING CONCEPTS</div><div class="ltext">Administrative Distance (AD): Connected=0, Static=1, OSPF=110, RIP=120, eBGP=20, iBGP=200. Longest prefix match wins — /32 beats /24 beats /0. ECMP load-balances across equal-cost paths. Recursive lookup resolves next-hop IPs through the FIB.</div></div>`;
  return rows;
}

function renderLog() {
  const tc = { ok: "#00ff88", warn: "#ffc700", info: "#2a5070", packet: "#60a5fa" };
  return `<div class="lhdr"><span class="field" style="margin:0">EVENT LOG</span><button class="lclr" id="lclr">CLEAR</button></div>
    <div>${N.logs.map(l => `<div class="log-i" style="border-color:${tc[l.t] || "#0e2040"}"><span class="lt">${l.time} </span><span style="color:${tc[l.t] || "#2a5070"}">${l.msg}</span></div>`).join("")}</div>`;
}

function refreshLabState() {
  const out = document.getElementById("lab-out");
  if (out) {
    const profile = SIM_PROFILES[LAB_STATE.profile] || SIM_PROFILES.normal;
    out.className = "tool-result";
    out.innerHTML = `${profile.desc}<br>${LAB_STATE.flows.length} live flow(s), ${LAB_STATE.blocked} firewall blocks, ${LAB_STATE.totalDrops} drops.`;
  }
  renderHUD();
}

function updateDevBtns() {
  document.querySelectorAll(".db").forEach(b => b.classList.toggle("active", b.dataset.t === addMode));
}

function updateConnBtn() {
  const b = document.getElementById("connbtn");
  const hint = document.getElementById("linkhint");
  const type = document.getElementById("linktype")?.value || N.selectedLinkType || "auto";
  const preset = edgePreset(type);
  b.classList.toggle("active", connMode);
  b.textContent = connMode ? `✕ Cancel • ${preset.label}` : `🔗 Connect Nodes • ${preset.label}`;
  if (hint) hint.textContent = connMode ? `Click a source node, then a target node. New links will use ${preset.label}.` : `Choose a preset for new links. Auto will infer a sensible link from the two endpoints.`;
}

function updateHints() {
  const ba = document.getElementById("b-add"), bc2 = document.getElementById("b-conn");
  const type = document.getElementById("linktype")?.value || N.selectedLinkType || "auto";
  const preset = edgePreset(type);
  if (addMode) { ba.style.display = ""; ba.textContent = `📍 Click canvas — ${D[addMode]?.l}`; bc2.style.display = "none"; } else if (connMode) { bc2.style.display = ""; bc2.textContent = connStart ? `Select target node • ${preset.label}` : `Select source node • ${preset.label}`; ba.style.display = "none"; } else { ba.style.display = "none"; bc2.style.display = "none"; }
}

function bindRight() {
  document.querySelectorAll(".pb").forEach(b => b.addEventListener("click", () => { selProto = b.dataset.p; renderRight(); }));
  const labProfile = document.getElementById("lab-profile");
  if (labProfile) labProfile.addEventListener("change", () => { LAB_STATE.profile = labProfile.value; refreshLabState(); });
  const labApply = document.getElementById("lab-apply");
  if (labApply) labApply.addEventListener("click", () => { applyProfile(document.getElementById("lab-profile")?.value || LAB_STATE.profile); refreshLabState(); });
  const labReset = document.getElementById("lab-reset");
  if (labReset) labReset.addEventListener("click", () => { stopAllLabFlows(); applyProfile("normal", false); refreshLabState(); });
  const labStop = document.getElementById("lab-stop");
  if (labStop) labStop.addEventListener("click", () => { stopAllLabFlows(); refreshLabState(); });
  const targetNode = selN ? nodeById(selN) : null;
  const labVoip = document.getElementById("lab-voip");
  if (labVoip) labVoip.addEventListener("click", () => { const flow = startLabFlow("voip", targetNode ? { dst: targetNode } : {}); if (flow) refreshLabState(); });
  const labStream = document.getElementById("lab-stream");
  if (labStream) labStream.addEventListener("click", () => { const flow = startLabFlow("stream", targetNode ? { dst: targetNode } : {}); if (flow) refreshLabState(); });
  const labWeb = document.getElementById("lab-web");
  if (labWeb) labWeb.addEventListener("click", () => { const flow = startLabFlow("web", targetNode ? { dst: targetNode } : {}); if (flow) refreshLabState(); });
  const labDos = document.getElementById("lab-dos");
  if (labDos) labDos.addEventListener("click", () => { const flow = startLabFlow("dos", targetNode ? { dst: targetNode } : {}); if (flow) refreshLabState(); });
  const labDdos = document.getElementById("lab-ddos");
  if (labDdos) labDdos.addEventListener("click", () => { const flow = startLabFlow("ddos", { distributed: true, dst: targetNode || pickScenarioEndPoints("ddos").dst }); if (flow) refreshLabState(); });
  const labSyn = document.getElementById("lab-syn");
  if (labSyn) labSyn.addEventListener("click", () => { const flow = startLabFlow("syn", targetNode ? { dst: targetNode } : {}); if (flow) refreshLabState(); });
  const labDns = document.getElementById("lab-dnsamp");
  if (labDns) labDns.addEventListener("click", () => { const flow = startLabFlow("dnsamp", { distributed: true, dst: targetNode || pickScenarioEndPoints("dnsamp").dst }); if (flow) refreshLabState(); });
  const lkType = document.getElementById("lk-type");
  if (lkType) lkType.addEventListener("change", () => { N.selectedLinkType = lkType.value; });
  const lkApply = document.getElementById("lk-apply");
  if (lkApply) lkApply.addEventListener("click", () => {
    const e = N.edges.find(x => x.id === selE);
    if (!e) return;
    const t = document.getElementById("lk-type")?.value || e.type || "ethernet";
    const p = edgePreset(t === "auto" ? inferLinkType(nodeById(e.s), nodeById(e.t), document.getElementById("lk-label")?.value || e.label) : t);
    e.type = t === "auto" ? inferLinkType(nodeById(e.s), nodeById(e.t), document.getElementById("lk-label")?.value || e.label) : t;
    e.label = document.getElementById("lk-label")?.value?.trim() || p.label;
    e.l = e.label;
    e.bw = Math.max(1, parseInt(document.getElementById("lk-bw")?.value || p.bw, 10) || p.bw);
    e.lat = Math.max(0, parseInt(document.getElementById("lk-lat")?.value || p.lat, 10) || p.lat);
    e.duplex = document.getElementById("lk-duplex")?.value || p.duplex;
    const pp = edgePreset(e.type);
    e.color = pp.c; e.dash = pp.dash; e.stroke = pp.stroke;
    N.selectedLinkType = e.type;
    const linkPick = document.getElementById("linktype");
    if (linkPick) linkPick.value = N.selectedLinkType;
    updateConnBtn();
    updateHints();
    addLog(`✎ Updated link: ${e.label} (${pp.label})`, "info");
    render(); renderRight();
  });
  const lkDel = document.getElementById("lk-del");
  if (lkDel) lkDel.addEventListener("click", () => {
    if (!selE) return;
    const remaining = N.edges.filter(e => e.id !== selE);
    N.edges.length = 0;
    N.edges.push(...remaining);
    addLog("🔗 Link removed", "warn");
    selE = null;
    render(); renderRight();
  });
  const spkt = document.getElementById("spkt");
  if (spkt) spkt.addEventListener("click", () => { const sn = nodeById(selN); if (!sn) return; const others = nodes.filter(n => n.id !== selN); if (!others.length) return; const t = others[Math.floor(Math.random() * others.length)]; spawn(selN, t.id, selProto); addLog(`📦 ${selProto}: ${sn.label}→${t.label}`, "packet"); });
  const bc = document.getElementById("bcast");
  if (bc) bc.addEventListener("click", () => { const sn = nodeById(selN); if (!sn) return; nodes.filter(n => n.id !== selN).forEach(t => { const ps = Object.keys(PR); spawn(selN, t.id, ps[Math.floor(Math.random() * ps.length)]); }); addLog(`📡 Broadcast from ${sn.label}`, "packet"); });
  const pingBtn = document.getElementById("ping-btn");
  if (pingBtn) pingBtn.addEventListener("click", () => { const ip = document.getElementById("ping-tgt").value; const ms = () => Math.round(Math.random() * 15 + 1); document.getElementById("ping-out").className = "tool-result"; document.getElementById("ping-out").innerHTML = `PING ${ip}:<br>64 bytes icmp_seq=1 ttl=64 time=${ms()} ms<br>64 bytes icmp_seq=2 ttl=64 time=${ms()} ms<br>64 bytes icmp_seq=3 ttl=64 time=${ms()} ms<br>4 packets: 0% loss`; nodes.forEach(n => { if (n.type !== "cloud") spawn(n.id, nodes[0]?.id || n.id, "ICMP"); }); });
  const trBtn = document.getElementById("tr-btn");
  if (trBtn) trBtn.addEventListener("click", () => { const ip = document.getElementById("tr-tgt").value; const hops = Math.floor(Math.random() * 8) + 5; let html = `<div style="font-size:8px;color:#00ddff;margin-bottom:4px">traceroute to ${ip}:</div>`; const pf = ["10.0.0", "192.168.0", "172.16.0", "10.1.0"]; for (let i = 1; i <= hops; i++) { const ms = Math.round(Math.random() * 30 + i * 2); html += `<div class="hop-row"><span class="hop-n">${i}</span><span class="hop-ip">${pf[i % pf.length]}.${Math.floor(Math.random() * 254) + 1}</span><span class="hop-ms">${ms} ms</span></div>`; } html += `<div class="hop-row"><span class="hop-n">${hops + 1}</span><span class="hop-ip">${ip}</span><span class="hop-ms">${Math.round(Math.random() * 8 + hops * 3)} ms</span></div>`; document.getElementById("tr-out").className = "tool-result"; document.getElementById("tr-out").innerHTML = html; });
  const snBtn = document.getElementById("sn-btn");
  if (snBtn) snBtn.addEventListener("click", () => { const ipStr = document.getElementById("sn-ip").value; const cidr = parseInt(document.getElementById("sn-cidr").value); const out = document.getElementById("sn-out"); const r = calcSubnet(ipStr, cidr); if (r) { out.className = "tool-result"; out.innerHTML = `<div class="subnet-row"><span class="sub-k">Network</span><span class="sub-v">${r.network}</span></div><div class="subnet-row"><span class="sub-k">Subnet mask</span><span class="sub-v">${r.mask}</span></div><div class="subnet-row"><span class="sub-k">Wildcard</span><span class="sub-v">${r.wildcard}</span></div><div class="subnet-row"><span class="sub-k">Broadcast</span><span class="sub-v">${r.broadcast}</span></div><div class="subnet-row"><span class="sub-k">First host</span><span class="sub-v">${r.firstHost}</span></div><div class="subnet-row"><span class="sub-k">Last host</span><span class="sub-v">${r.lastHost}</span></div><div class="subnet-row"><span class="sub-k">Usable hosts</span><span class="sub-v">${r.usableHosts.toLocaleString()}</span></div>`; } else { out.className = "tool-err"; out.textContent = "Invalid input — use format: 192.168.1.0 / 24"; } });
  const nsBtn = document.getElementById("ns-btn");
  if (nsBtn) nsBtn.addEventListener("click", () => { const q = document.getElementById("ns-q").value; const ip = `${Math.floor(Math.random() * 220) + 10}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254) + 1}`; document.getElementById("ns-out").className = "tool-result"; document.getElementById("ns-out").innerHTML = `Server: 8.8.8.8<br>Query: ${q} A<br>Answer: ${ip} TTL=${Math.floor(Math.random() * 3000) + 300}s<br>AAAA: 2607:f8b0::${Math.floor(Math.random() * 9999).toString(16)}`; nodes.filter(n => n.type === "dns").forEach(dn => nodes.forEach(n => { if (n.id !== dn.id) spawn(n.id, dn.id, "DNS"); })); });
  const lclr = document.getElementById("lclr");
  if (lclr) lclr.addEventListener("click", () => { N.logs.length = 0; renderRight(); });
}

/* ── Main loop ── */

let lastTs = 0;

function loop(ts) {
  if (typeof document !== 'undefined') requestAnimationFrame(loop);
  const dt = Math.min((ts - lastTs) / 1000, 0.1);
  lastTs = ts;
  if (ts - lastPps > 1000) { pps = N.ppsCount; N.ppsCount = 0; lastPps = ts; renderHUD(); }
  if (!running) { renderPkts(); return; }
  spawnLabTraffic(dt);
  if (ts - lastSpawn > 900 / N.speed && nodes.length >= 2 && LAB_STATE.flows.length < 1) {
    lastSpawn = ts;
    const src = nodes[Math.floor(Math.random() * nodes.length)];
    const others = nodes.filter(n => n.id !== src.id);
    if (others.length) {
      const tgt = others[Math.floor(Math.random() * others.length)];
      const ps = Object.keys(PR);
      spawn(src.id, tgt.id, ps[Math.floor(Math.random() * ps.length)]);
    }
  }
  const pressureMap = new Map();
  for (const pkt of pkts) {
    const a = nodeById(pkt.path[pkt.seg]), b = nodeById(pkt.path[pkt.seg + 1]);
    if (a && b && edgeByNodes(a.id, b.id)) edgePressure(pressureMap, edgeByNodes(a.id, b.id), pkt);
  }
  const dead = [];
  for (let i = 0; i < pkts.length; i++) {
    const pkt = pkts[i];
    pkt.age += (dt * N.speed);
    const a = nodeById(pkt.path[pkt.seg]), b = nodeById(pkt.path[pkt.seg + 1]);
    if (!a || !b) { dead.push(i); continue; }
    const edge = edgeByNodes(a.id, b.id);
    if (!edge) { dead.push(i); continue; }
    const pressure = pressureMap.get(edgeKey(edge.s, edge.t)) || { count: 0, bytes: 0, attack: 0 };
    pkt.edgeLoad = pressure.count;
    const qm = packetMoveFactor(edge, pressure, pkt);
    const lossChance = clamp(qm.loss + Math.max(0, qm.load * 0.02) + (pkt.attack ? 0.012 : 0), 0, 0.92);
    if (Math.random() < lossChance * dt * 8) { LAB_STATE.totalDrops++; dead.push(i); continue; }
    pkt.t += dt * N.speed * qm.step;
    if (pkt.t >= 1) {
      const nextIndex = pkt.seg + 1;
      const nextNode = nodeById(pkt.path[nextIndex]);
      if (nextNode && firewallNode(nextNode) && !firewallVerdict(nextNode, pkt)) { dead.push(i); continue; }
      if (nextIndex >= pkt.path.length - 1) {
        LAB_STATE.delivered++;
        if (pkt.attack) {
          const tgt = nodeById(pkt.target);
          if (tgt && Math.random() < 0.03) {
            const now = performance.now();
            if (now - LAB_STATE.lastLogAt > 1200) {
              addLog(`🧨 ${tgt.label} is under ${pkt.kind} pressure`, "warn");
              LAB_STATE.lastLogAt = now;
            }
          }
        }
        dead.push(i);
        continue;
      }
      pkt.seg = nextIndex;
      pkt.t = 0;
      pkt.delay += (qm.metrics.lat + qm.jitterMs);
    }
  }
  for (let i = dead.length - 1; i >= 0; i--) pkts.splice(dead[i], 1);
  if (pkts.length > 260) pkts.splice(0, pkts.length - 260);
  renderPkts();
}

/* ── DOM Setup ── */

if (typeof document !== 'undefined') {
  svg.addEventListener("mousemove", e => {
    if (!drag) return;
    const pt = svgPt(e);
    const nd = nodes.find(n => n.id === drag);
    if (nd) { nd.x = Math.max(25, Math.min(795, pt.x - doff.x)); nd.y = Math.max(25, Math.min(555, pt.y - doff.y)); }
    render();
  });
  svg.addEventListener("mouseup", () => { drag = null; });
  svg.addEventListener("mouseleave", () => { drag = null; });
  svg.addEventListener("click", e => {
    const bg = e.target === svg || e.target.tagName === "rect" || e.target.tagName === "pattern";
    if (addMode && bg) {
      const pt = svgPt(e);
      const id = `n${Date.now()}`;
      N.nodes.push({ id, type: addMode, x: pt.x, y: pt.y, label: D[addMode]?.l || addMode, ip: null });
      addLog(`+ ${D[addMode]?.l}`, "ok");
      addMode = null;
      updateDevBtns();
      updateHints();
      svg.className.baseVal = "";
      render();
      renderRight();
      return;
    }
    if (!addMode) {
      selN = null;
      selE = null;
      if (connMode && connStart) { connMode = false; connStart = null; updateConnBtn(); updateHints(); svg.className.baseVal = ""; }
      render();
      renderRight();
    }
  });

  document.querySelectorAll(".db").forEach(b => b.addEventListener("click", () => {
    addMode = addMode === b.dataset.t ? null : b.dataset.t;
    connMode = false;
    connStart = null;
    updateDevBtns();
    updateConnBtn();
    updateHints();
    svg.className.baseVal = "";
    if (addMode) svg.classList.add("m-add");
  }));
  document.getElementById("connbtn").addEventListener("click", () => {
    connMode = !connMode;
    connStart = null;
    addMode = null;
    updateDevBtns();
    updateConnBtn();
    updateHints();
    svg.className.baseVal = "";
    if (connMode) svg.classList.add("m-conn");
  });
  document.getElementById("linktype").addEventListener("change", e => { N.selectedLinkType = e.target.value; updateConnBtn(); updateHints(); });
  document.getElementById("delbtn").addEventListener("click", () => {
    if (selN) {
      const remNodes = N.nodes.filter(n => n.id !== selN);
      N.nodes.length = 0;
      N.nodes.push(...remNodes);
      const remEdges = N.edges.filter(e => e.s !== selN && e.t !== selN);
      N.edges.length = 0;
      N.edges.push(...remEdges);
      const remPkts = N.pkts.filter(p => !p.path.includes(selN));
      N.pkts.length = 0;
      N.pkts.push(...remPkts);
      addLog("🗑 Node deleted", "warn");
      selN = null;
    } else if (selE) {
      const remEdges = N.edges.filter(e => e.id !== selE);
      N.edges.length = 0;
      N.edges.push(...remEdges);
      addLog("🗑 Link deleted", "warn");
      selE = null;
    }
    render();
    renderRight();
  });
  document.getElementById("clrpkt").addEventListener("click", () => { N.pkts.length = 0; addLog("🧹 Packets cleared", "info"); });
  document.getElementById("clrall").addEventListener("click", () => {
    N.nodes.length = 0;
    N.edges.length = 0;
    N.pkts.length = 0;
    selN = null;
    selE = null;
    addLog("✕ Canvas cleared", "warn");
    render();
    renderRight();
  });
  document.getElementById("rbtn").addEventListener("click", () => {
    running = !running;
    const b = document.getElementById("rbtn");
    b.className = "run-btn " + (running ? "run-run" : "run-pause");
    b.textContent = running ? "⏸ PAUSE" : "▶ RUN";
  });
  document.querySelectorAll(".spd-btn").forEach(b => b.addEventListener("click", () => {
    N.speed = parseFloat(b.dataset.s);
    document.querySelectorAll(".spd-btn").forEach(x => x.classList.toggle("active", x.dataset.s === b.dataset.s));
  }));
  document.querySelectorAll(".rt").forEach(b => b.addEventListener("click", () => {
    activeTab = b.dataset.r;
    document.querySelectorAll(".rt").forEach(x => x.classList.toggle("active", x.dataset.r === activeTab));
    renderRight();
  }));

  const scKeys = Object.keys(SCENARIOS);
  const scTabEl = document.getElementById("sc-tabs");
  scKeys.forEach(k => {
    const b = document.createElement("button");
    b.className = "sc-btn";
    b.dataset.k = k;
    b.textContent = SCENARIOS[k].name;
    b.addEventListener("click", () => loadSc(k));
    scTabEl.appendChild(b);
  });

  initSidebarWidths();
  updateConnBtn();
  updateHints();

  const tLeftBtn = document.getElementById('toggle-left');
  const tRightBtn = document.getElementById('toggle-right');
  if (tLeftBtn) {
    tLeftBtn.addEventListener('click', () => { const open = document.body.classList.toggle('drawer-left-open'); tLeftBtn.setAttribute('aria-expanded', String(open)); if (open) document.body.classList.remove('drawer-right-open'); });
  }
  if (tRightBtn) {
    tRightBtn.addEventListener('click', () => { const open = document.body.classList.toggle('drawer-right-open'); tRightBtn.setAttribute('aria-expanded', String(open)); if (open) document.body.classList.remove('drawer-left-open'); });
  }
  svg.addEventListener('click', () => {
    if (document.body.classList.contains('drawer-left-open') || document.body.classList.contains('drawer-right-open')) {
      document.body.classList.remove('drawer-left-open');
      document.body.classList.remove('drawer-right-open');
      tLeftBtn?.setAttribute('aria-expanded', 'false');
      tRightBtn?.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', e => {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); running = !running; const b = document.getElementById('rbtn'); b.className = 'run-btn ' + (running ? 'run-run' : 'run-pause'); b.textContent = running ? "⏸ PAUSE" : "▶ RUN"; } else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); tLeftBtn?.click(); } else if (e.key === 'h' || e.key === 'H') { e.preventDefault(); tRightBtn?.click(); } else if (e.key === 'c' || e.key === 'C') { e.preventDefault(); document.getElementById('connbtn')?.click(); }
  });

  const leftResize = document.getElementById("l-resize");
  const rightResize = document.getElementById("r-resize");
  if (leftResize) {
    const startLeftResize = e => { e.preventDefault(); beginResize("left", e); };
    leftResize.addEventListener("pointerdown", startLeftResize);
    leftResize.addEventListener("mousedown", startLeftResize);
    leftResize.addEventListener("keydown", e => {
      const step = e.shiftKey ? 24 : 12;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const { leftMin, leftMax } = sidebarBounds();
        const left = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--left-w")) || 148;
        applySidebarWidths(clamp(left + (e.key === "ArrowRight" ? step : -step), leftMin, leftMax), clamp(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--right-w")) || 286, sidebarBounds().rightMin, sidebarBounds().rightMax));
      }
    });
  }
  if (rightResize) {
    const startRightResize = e => { e.preventDefault(); beginResize("right", e); };
    rightResize.addEventListener("pointerdown", startRightResize);
    rightResize.addEventListener("mousedown", startRightResize);
    rightResize.addEventListener("keydown", e => {
      const step = e.shiftKey ? 24 : 12;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const { rightMin, rightMax, leftMin } = sidebarBounds();
        const right = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--right-w")) || 286;
        applySidebarWidths(clamp(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--left-w")) || 148, leftMin, sidebarBounds().leftMax), clamp(right + (e.key === "ArrowLeft" ? step : -step), rightMin, rightMax));
      }
    });
  }
  document.addEventListener("pointermove", moveResize);
  document.addEventListener("mousemove", moveResize);
  document.addEventListener("pointerup", endResize);
  document.addEventListener("mouseup", endResize);
  document.addEventListener("pointercancel", endResize);
  window.addEventListener("resize", () => {
    const b = sidebarBounds();
    applySidebarWidths(clamp(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--left-w")) || 148, b.leftMin, b.leftMax), clamp(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--right-w")) || 286, b.rightMin, b.rightMax));
  });

  requestAnimationFrame(loop);
  loadSc("home");
}

/* ── Re-exports (for tests) ── */
export {
  clamp,
  calcSubnet,
  edgeKey,
  edgePreset,
  inferLinkType,
  normalizeEdge,
  firewallNode,
  hostNodes,
  currentProfile,
  bfs,
  firewallVerdict,
  edgeMetrics,
  edgePressure,
  packetMoveFactor,
  nodeById,
  edgeByNodes,
  nodes,
  edges,
  pkts,
  LAB_STATE,
  SIM_PROFILES,
  LINK_PRESETS,
  PR,
  D,
  addLog,
  spawn,
  spawnFlowPacket,
};
