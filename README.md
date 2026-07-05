# ◉ NetLab v1.0.0 — Interactive Network Learning Platform

A complete, self-contained network education platform that runs entirely in the browser.
No server, no install, no dependencies. Open `index.html` to start.

## Files

```text
netlab/
├── index.html              ← Landing page — start here
├── netlab-simulator.html   ← Topology Simulator
├── netlab-pro.html         ← Pro Analysis Module
├── js/
│   ├── index.js            ← Application entry point (DOM wiring, rendering, main loop)
│   ├── core/
│   │   ├── constants.js    ← All constants (devices, protocols, presets, scenarios)
│   │   ├── state.js        ← Global mutable state (N, LAB_STATE)
│   │   ├── utils.js        ← Pure utility functions (clamp, calcSubnet, sidebar resize)
│   │   ├── network.js      ← Network logic (link inference, BFS, node/edge queries)
│   │   └── sim-core.js     ← Simulation engine (traffic, spawning, firewall verdict)
│   ├── simulator.js        ← Built bundle (Rollup)
│   └── pro.js              ← Pro module built bundle
├── scripts/
│   ├── build.js            ← Rollup build script (no external config)
│   └── run-sanity-tests.js ← Sanity test runner
├── tests/
│   ├── setup.js            ← Test env setup
│   ├── helpers.js          ← Test helpers (DOM stubs, snapshot helper)
│   └── unit/
│       ├── utils.test.js   ← Unit tests for utils
│       ├── network.test.js ← Unit tests for network logic
│       ├── sim-core.test.js← Unit tests for simulation engine
│       └── integration.test.js ← Integration tests
├── vitest.config.js        ← Test configuration
├── .github/
│   └── workflows/
│       ├── ci.yml          ← CI (lint, build, test, dep audit, coverage upload)
│       ├── pages-deploy.yml← GitHub Pages deployment
│       └── codeql.yml      ← CodeQL security analysis
├── LICENSE
├── CHANGELOG.md
└── README.md
```

Build output goes to `dist/` (gitignored) — `npm run build` produces `dist/netlab.js` and `dist/netlab.min.js`.

## Module 1 — Topology Simulator (`netlab-simulator.html`)

### Simulator features

- **Animated packet flows** — colored protocol packets traverse links in real time
- **14 device types** — PC, Laptop, Server, Web Server, Router, L3 Switch, L2 Switch, Hub, Firewall, NGFW, WiFi AP, Internet/Cloud, DNS, Load Balancer
- **8 preset scenarios**:
  - 🏠 Home Network (DHCP, NAT, DNS basics)
  - 🏢 Enterprise DMZ (3-zone security, VLANs)
  - 🔒 VPN (Site-to-site IPsec)
  - 🏗️ Datacenter (Spine-leaf, load balancer, DB cluster)
  - ☁️ Hybrid Cloud (On-prem ↔ Cloud VPC)
  - 🌐 WAN/BGP (Multi-site MPLS, BGP AS)
  - 📍 OSPF Multi-area (ABRs, Areas 0/1/2)
  - 🔁 STP (Redundant switches, root bridge, blocking ports)
- **Drag-and-drop** topology editing
- **Right panel tabs**:
  - **INFO** — Node/link inspector + educational explainer
  - **PACKET** — Header structure visualizer + protocol explainer
  - **OSI** — Full 7-layer reference with expandable details
  - **TCP** — 3-way handshake + 4-way teardown walkthrough
  - **TOOLS** — Ping, Traceroute, Subnet Calculator, nslookup simulators
  - **VLAN** — Per-scenario VLAN configuration table
  - **ROUTING** — Routing table with AD values
  - **LOG** — Event log

### Simulator controls

- **Left panel** — Click a device type, then click the canvas to place it
- **Connect** tool — Wire nodes together
- **Speed** — ½×, 1×, 2×, 3× simulation speed
- **Pause/Run** — Freeze or resume packet animation
- Click any **node** or **link** to inspect it

## Module 2 — Pro Analysis Module (`netlab-pro.html`)

### Packet capture features

- Live stream of simulated packets with protocol coloring
- Filter by protocol (15 protocols)
- **PACKET LIST** — scrollable capture buffer, 200 packets
- **DISSECT** — per-layer protocol dissection (Ethernet → IP → TCP/UDP → App)
- **HEX DUMP** — raw bytes with ASCII sidebar
- **STREAM** — TCP stream reconstruction view

### Attack lab

- **ARP Spoofing** — MitM via cache poisoning → DAI defense
- **SYN Flood** — DoS via half-open connection exhaustion → SYN cookies
- **VLAN Hopping** — Double-tagging bypass → native VLAN hardening
- **DNS Amplification** — DDoS via open resolvers → BCP38/RRL

### Protocol walkthroughs

Step-by-step animated state machines with packet-level detail:

- **DHCP DORA** — Discover → Offer → Request → ACK
- **DNS Resolution** — Cache → Recursive → Root → TLD → Authoritative
- **TLS 1.3 Handshake** — ClientHello → ServerHello → KeyDerive → Finished → AppData
- **OSPF Neighbor** — Hello → 2-Way → DBD → LSR/LSU → FULL + SPF

### NAT / ARP

- Live NAT translation table (PAT/overload) populated from capture
- Live ARP cache with IP→MAC mappings and TTLs
- NAT type explanations (Static, Dynamic, PAT, NAT64)

### Live graphs

- Real-time bandwidth (Mbps), latency (ms), packets/sec charts
- Protocol distribution breakdown with percentages

### Quiz

- 10 CCNA-level questions (OSI, TCP, ARP, VLAN, OSPF, NAT, STP)
- Detailed explanations for every answer
- Progress bar and study tips

## Supported protocols

| Protocol | Color | Port | Layer |
| --- | --- | --- | --- |
| ICMP | 🟡 Gold | — | L3 |
| TCP | 🔵 Cyan | var | L4 |
| UDP | 🟢 Green | var | L4 |
| HTTP | 🔵 Blue | 80 | L7 |
| HTTPS | 🟢 Teal | 443 | L7 |
| DNS | 🟣 Purple | 53 | L7 |
| DHCP | 🟠 Orange | 67/68 | L7 |
| ARP | 🩷 Pink | — | L2 |
| BGP | 🔴 Red | 179 | L4 |
| OSPF | 🟠 Orange | — | L3 |
| TLS | 🔵 Cyan | 443 | L6 |
| SSH | 🟣 Purple | 22 | L7 |
| SMTP | 🩷 Pink | 25 | L7 |
| SNMP | 🟢 Lime | 161 | L7 |
| NTP | 🔵 Sky | 123 | L7 |

## Browser compatibility

Works in any modern browser (Chrome, Firefox, Edge, Safari).
No external libraries, no CDN, no internet connection required after download.

*NetLab v1.0.0 — Built for learning, not just watching.*

## Deployment

To publish a demo site quickly, build the assets and deploy the `dist/` folder.

```bash
npm ci
npm run build
```

You can then publish `dist/` with GitHub Pages, Netlify, or any static host.
