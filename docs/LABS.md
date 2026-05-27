# NetLab Learning Labs

This document contains guided labs from beginner to advanced. Each lab includes objectives, steps, and checks.

## Lab 1 — Ping, ARP, and Subnetting (Beginner)

- Objectives: Use ping simulator, inspect ARP, calculate subnets.

- Steps:

  1. Open `netlab-simulator.html`
  2. Load the 'Home' scenario.
  3. Select a PC, open INFO → Send ICMP packet to the router.
  4. Use TOOLS → Subnet Calculator to compute /28 from 192.168.1.0.
  5. Observe ARP entries in the PRO module (open `netlab-pro.html`).

## Lab 2 — VLANs and Inter-VLAN Routing (Intermediate)

- Objectives: Create VLANs, simulate inter-VLAN routing via an L3 switch.

- Steps:

  1. Load 'Enterprise' scenario.
  2. Inspect VLAN tab and routing table.
  3. Add hosts in different VLANs and show that packets traverse via the L3 SVI.

## Lab 3 — BGP and WAN (Advanced)

- Objectives: Observe route advertisement and path selection.

- Steps:

  1. Load 'WAN/BGP' scenario.
  2. Open PRO module and watch BGP update messages in the capture list.
  3. Modify routing (manually change a route entry in the scenario file) and observe selection changes.

## Contributing labs

- Add new labs by creating a markdown file under `docs/` and referencing scenario keys from `js/simulator.js`.
