/* NetLab v1.0.0 — Topology Simulator Core */

const D={
  pc:{l:"PC",i:"🖥️",c:"#3b82f6"},laptop:{l:"Laptop",i:"💻",c:"#6366f1"},
  server:{l:"Server",i:"🗄️",c:"#10b981"},web:{l:"Web Server",i:"🌐",c:"#06b6d4"},
  router:{l:"Router",i:"📡",c:"#f59e0b"},l3sw:{l:"L3 Switch",i:"🔀",c:"#f97316"},
  switch:{l:"Switch",i:"⬡",c:"#a78bfa"},hub:{l:"Hub",i:"⬡",c:"#a78bfa"},
  firewall:{l:"Firewall",i:"🛡️",c:"#ef4444"},ngfw:{l:"NGFW",i:"🛡️",c:"#dc2626"},
  ap:{l:"WiFi AP",i:"📶",c:"#06b6d4"},cloud:{l:"Internet",i:"☁️",c:"#64748b"},
  dns:{l:"DNS",i:"🔍",c:"#34d399"},lb:{l:"Load Balancer",i:"⚖️",c:"#f472b6"}
};

const PR={
  ICMP:{c:"#ffd700",port:null,l:"L3 — no ports",info:"Used for ping, traceroute, and network diagnostics. ICMP Echo Request (type 8) and Echo Reply (type 0) form the basis of 'ping'. No ports — operates at Layer 3 directly. Routers use ICMP Time Exceeded to signal TTL expiry for traceroute."},
  TCP:{c:"#00ddff",port:"var",l:"L4 — reliable",info:"Connection-oriented. 3-way handshake (SYN→SYN-ACK→ACK). Sequence numbers ensure ordering. ACKs confirm delivery. Retransmission on timeout. Flow control via sliding window. Congestion control: CWND, slow start, AIMD."},
  UDP:{c:"#00ff88",port:"var",l:"L4 — fast",info:"Connectionless, no guarantee. No handshake, no retransmit, no ordering. Faster and lower overhead than TCP. Used for DNS, DHCP, streaming, VoIP, online gaming. Applications implement reliability if needed (QUIC, custom protocols)."},
  HTTP:{c:"#60a5fa",port:"80",l:"L7 — web",info:"GET/POST/PUT/DELETE over TCP port 80. Stateless. HTTP/1.1 uses persistent connections. HTTP/2 adds multiplexed streams over TLS. HTTP/3 runs over QUIC (UDP). Headers carry Host, Content-Type, Authorization, cookies."},
  HTTPS:{c:"#34d399",port:"443",l:"L7 — secure web",info:"HTTP over TLS. TLS 1.3 does 1-RTT handshake: ClientHello with supported ciphers → ServerHello + certificate → Finished. Uses ECDHE for perfect forward secrecy. Data encrypted with symmetric AES-GCM after handshake."},
  DNS:{c:"#a855f7",port:"53",l:"L7 — name resolution",info:"UDP port 53 (TCP for zone transfers). Recursive resolution: client → recursive resolver → root → TLD → authoritative. TTL caches responses. DNSSEC adds RRSIG records. Types: A, AAAA, MX, CNAME, NS, TXT, PTR, SRV."},
  DHCP:{c:"#fb923c",port:"67/68",l:"L7 — IP assignment",info:"UDP broadcast. 4-step DORA: Discover (client broadcasts) → Offer (server proposes IP) → Request (client accepts) → ACK (server confirms). Assigns IP, subnet mask, default gateway, DNS, lease time. Uses relay agents for cross-VLAN delivery."},
  ARP:{c:"#f472b6",port:null,l:"L2 — MAC discovery",info:"Resolves IP to MAC within a subnet. Client broadcasts 'Who has 10.0.0.1?' All hosts in L2 domain receive it. Owner replies with its MAC. Cached in ARP table (minutes). Gratuitous ARP announces IP ownership. Proxy ARP and ARP spoofing are key attack vectors."},
  BGP:{c:"#ef4444",port:"179",l:"L4 — inter-AS routing",info:"TCP port 179. eBGP between different ASes; iBGP inside. Exchanges path vectors (AS_PATH attribute). BGP selects best route by: Local Preference → AS_PATH length → MED → eBGP > iBGP → IGP metric. Powers the entire Internet routing table."},
  OSPF:{c:"#f97316",port:null,l:"L3 — link-state IGP",info:"IP protocol 89. Dijkstra's shortest path first (SPF) algorithm on the full topology map (LSDB). Routers exchange LSAs: Router-LSA, Network-LSA, Summary-LSA. Areas reduce LSDB size. Convergence is fast — sub-second with BFD."}
};

const OSI_DATA=[
  {n:7,name:"Application",c:"#ef4444",proto:"HTTP, HTTPS, DNS, DHCP, FTP, SMTP, SSH, SNMP, BGP",d:"User-facing protocols. PDU = Data.",detail:"The application layer is where user-data meets the network. Protocols define message syntax, semantics, and session rules. HTTP is stateless — each request is independent unless cookies or tokens maintain state. DNS is the phonebook: apps resolve names to IPs before connecting. SMTP transfers email between mail servers on TCP 25."},
  {n:6,name:"Presentation",c:"#f97316",proto:"TLS/SSL, MIME, Base64, JPEG, MPEG, Protobuf, JSON",d:"Encoding, encryption, compression. PDU = Data.",detail:"Often merged with Application in practice. TLS encrypts data here before it goes to TCP. MIME encoding wraps binary email attachments. Protobuf and MessagePack serialize structured data efficiently."},
  {n:5,name:"Session",c:"#eab308",proto:"NetBIOS, RPC, SIP, H.323, NFS, SQL sessions",d:"Session open/close, checkpointing. PDU = Data.",detail:"Manages dialog control between applications. SIP sets up voice/video calls (signaling), then RTP carries the media. NFS uses RPC for remote file access sessions. SQL connections maintain a session with state."},
  {n:4,name:"Transport",c:"#22c55e",proto:"TCP, UDP, SCTP, QUIC, DCCP, TLS (handshake)",d:"Port numbers, reliability, flow control. PDU = Segment/Datagram.",detail:"TCP segments carry: sequence number, ACK number, window size, flags (SYN/ACK/FIN/RST/PSH). The 3-way handshake establishes state on both ends. UDP datagrams have just src port, dst port, length, checksum (8 bytes total). QUIC runs over UDP but adds stream multiplexing and TLS 1.3 built-in — used by HTTP/3."},
  {n:3,name:"Network",c:"#3b82f6",proto:"IPv4, IPv6, ICMP, ICMPv6, IGMP, OSPF, BGP, MPLS",d:"IP addressing, routing, TTL, fragmentation. PDU = Packet.",detail:"IPv4 header: version, IHL, DSCP, total length, ID, flags, fragment offset, TTL, protocol, checksum, src IP, dst IP. TTL decremented at each router hop — reaches 0 → ICMP Time Exceeded → traceroute. Routers consult FIB for longest-prefix match."},
  {n:2,name:"Data Link",c:"#8b5cf6",proto:"Ethernet 802.3, WiFi 802.11, PPP, VLAN 802.1Q, MPLS",d:"MAC addresses, frames, CRC, switches. PDU = Frame.",detail:"Ethernet frame: preamble (7B) + SFD (1B) + dst MAC (6B) + src MAC (6B) + EtherType (2B) + payload (46-1500B) + FCS (4B CRC). Switches learn MACs per-port in CAM table. 802.1Q VLAN tag is a 4-byte field inserted after src MAC."},
  {n:1,name:"Physical",c:"#ec4899",proto:"Copper Cat5e/6, Fiber SMF/MMF, 802.11 radio, 5G NR",d:"Bits on wire/air/fiber. PDU = Bits.",detail:"Cat6A copper: 10 Gbps to 100m. Single-mode fiber: hundreds of km range. Multi-mode fiber: up to ~500m. WiFi 802.11ax (WiFi 6): OFDMA subcarrier allocation, 1024-QAM, BSS coloring for dense deployments."}
];

const DEVINFO={
  router:"Routers operate at Layer 3. They maintain a routing table (RIB) and forwarding table (FIB). Each interface is in a different subnet. Static routes, OSPF, EIGRP, and BGP populate the RIB. NAT/PAT translates private RFC1918 addresses to public IPs.",
  l3sw:"Layer 3 switches combine MAC learning of L2 switches with IP routing. Inter-VLAN routing: each VLAN gets an SVI (switched virtual interface) acting as its default gateway. Much faster than a separate router for intra-datacenter traffic.",
  switch:"L2 switches forward Ethernet frames using the CAM table — a hardware-assisted MAC-to-port mapping. Unknown unicast frames are flooded to all ports. VLAN trunks carry 802.1Q tagged frames. Spanning Tree Protocol (STP/RSTP/MSTP) blocks redundant links.",
  firewall:"Zone-based firewalls partition interfaces into security zones (Inside/Outside/DMZ). Stateful inspection tracks TCP/UDP sessions. ACLs match on src/dst IP, port, protocol. NGFW adds Layer 7 app identification, URL filtering, IPS signatures, TLS inspection.",
  ngfw:"Next-Generation Firewalls add application awareness via deep packet inspection beyond Layer 4. Features: App-ID identifies apps by payload patterns; User-ID maps traffic to AD users; IPS detects exploits; SSL/TLS decryption for east-west inspection.",
  lb:"Load balancers distribute traffic across a pool of servers. L4 LBs route by IP/port only. L7 LBs inspect HTTP headers for content-based routing. Algorithms: Round Robin, Least Connections, IP Hash. Health checks detect failed backends.",
  server:"Servers bind to a well-known TCP/UDP port. The kernel listens with a backlog queue. Each connection gets a new socket (5-tuple). Nginx and HAProxy are event-driven, handling 50k+ concurrent connections.",
  web:"Web servers handle HTTP/HTTPS. HTTPS requires TLS certificate (X.509), private key, CA chain. TLS 1.3 handshake: ClientHello → ServerHello+Cert → CertVerify → Finished. 1 RTT. HSTS pins HTTPS.",
  dns:"DNS resolves FQDNs hierarchically: Recursive resolver → Root → TLD → Authoritative nameserver. UDP port 53. DNSSEC adds cryptographic signing. Records: A, AAAA, MX, CNAME, NS, TXT, PTR, SRV.",
  ap:"802.11ax (WiFi 6) uses OFDMA — multiple clients share the same channel on different subcarriers. MU-MIMO: up to 8 spatial streams. WPA3-SAE replaces WPA2-PSK with a Diffie-Hellman key exchange.",
  hub:"Hubs are Layer 1 repeaters — all ports share one collision domain. Every bit received is re-broadcast to every other port. CSMA/CD managed collisions. Half-duplex only. 10/100 Mbps. Completely obsolete.",
  pc:"End hosts run the full TCP/IP stack in the OS kernel. On startup: DHCP DORA to get IP/mask/gateway/DNS. To communicate outside the subnet: ARP for gateway MAC → send packet to gateway. DNS query to resolve hostname.",
  laptop:"Wireless clients authenticate to the AP via WPA3-SAE association. 4-way handshake derives PTK for unicast encryption. After association, standard DHCP/ARP/TCP stack applies.",
  cloud:"The Internet core is ~100,000 BGP Autonomous Systems. Each AS advertises its IP prefixes via eBGP. Tier-1 ISPs: Cogent, NTT, Level3/Lumen. Content providers peer directly at IXPs. Anycast routes the same prefix from multiple locations.",
  
};

const LINK_PRESETS={
  auto:{label:"Auto",c:"#9ab5cc",bw:1000,lat:2,medium:"Smart inference",duplex:"full",dash:"none",stroke:1.8,desc:"Auto-picks a sensible type from the endpoints."},
  ethernet:{label:"Ethernet",c:"#00ddff",bw:1000,lat:2,medium:"Copper / RJ-45",duplex:"full",dash:"none",stroke:1.9,desc:"Standard wired LAN link."},
  fiber:{label:"Fiber",c:"#00ff88",bw:10000,lat:1,medium:"Fiber optic",duplex:"full",dash:"none",stroke:2.4,desc:"High-speed optical uplink / backbone."},
  wifi24:{label:"2.4GHz Wi‑Fi",c:"#a78bfa",bw:150,lat:8,medium:"802.11 wireless",duplex:"half",dash:"7 4",stroke:1.7,desc:"Longer range, slower wireless link."},
  wifi5:{label:"5GHz Wi‑Fi",c:"#8b5cf6",bw:600,lat:5,medium:"802.11ac/ax",duplex:"half",dash:"5 4",stroke:1.8,desc:"Faster Wi‑Fi with shorter range."},
  dns:{label:"DNS",c:"#f472b6",bw:50,lat:12,medium:"Service flow",duplex:"full",dash:"2 5",stroke:1.7,desc:"Logical DNS service path / query link."},
  wan:{label:"WAN",c:"#f59e0b",bw:100,lat:22,medium:"ISP / Internet",duplex:"full",dash:"10 4",stroke:1.9,desc:"Provider edge / Internet handoff."},
  vpn:{label:"VPN",c:"#ffc700",bw:100,lat:28,medium:"Encrypted tunnel",duplex:"full",dash:"8 4 2 4",stroke:1.9,desc:"Encrypted site-to-site tunnel."},
  trunk:{label:"Trunk",c:"#06b6d4",bw:40000,lat:1,medium:"802.1Q trunk",duplex:"full",dash:"none",stroke:2.3,desc:"Tagged multi-VLAN uplink."},
  direct:{label:"Direct",c:"#9bd0ff",bw:1000,lat:1,medium:"Direct connection",duplex:"full",dash:"none",stroke:1.7,desc:"Generic direct link."}
};

const LINK_CHOICES=["auto","ethernet","fiber","wifi24","wifi5","dns","wan","vpn","trunk","direct"];

const SIM_PROFILES={
  normal:{label:"Normal",loss:0.002,latAdd:0,bwScale:1,desc:"Balanced traffic and stable links."},
  poorwifi:{label:"Poor Wi‑Fi",loss:0.06,latAdd:38,bwScale:0.38,desc:"Weak signal, retries, jitter, and visible lag."},
  congested:{label:"Congested",loss:0.03,latAdd:24,bwScale:0.62,desc:"Busy network with queueing and slower response."},
  fiber:{label:"Fiber",loss:0.0005,latAdd:0,bwScale:1.45,desc:"Fast backbone with low latency."},
  overload:{label:"Overload",loss:0.08,latAdd:58,bwScale:0.28,desc:"Severe saturation and heavy drops."}
};

const LAB_PRESETS={
  voip:{label:"VoIP call",kind:"voip",proto:"UDP",rate:24,size:176,attack:false,desc:"RTP-like voice packets — low bitrate, latency-sensitive."},
  stream:{label:"Video stream",kind:"stream",proto:"UDP",rate:42,size:1180,attack:false,desc:"Continuous media stream — bandwidth-hungry and jitter-sensitive."},
  web:{label:"Web traffic",kind:"web",proto:"TCP",rate:8,size:900,attack:false,desc:"Normal web browsing burst and response pattern."},
  dos:{label:"DoS flood",kind:"dos",proto:"TCP",rate:120,size:72,attack:true,desc:"Single-source flood that overwhelms a target quickly."},
  ddos:{label:"DDoS flood",kind:"ddos",proto:"UDP",rate:220,size:1200,attack:true,desc:"Distributed flood from multiple sources to saturate links and services."},
  syn:{label:"SYN flood",kind:"syn-flood",proto:"TCP",rate:180,size:64,attack:true,desc:"Half-open TCP handshakes fill server queues and firewalls."},
  dnsamp:{label:"DNS amplification",kind:"dns-amplification",proto:"UDP",rate:150,size:128,attack:true,desc:"Small query, large response amplification pressure."}
};

const LAB_STATE={
  profile:"normal",
  flows:[],
  totalDrops:0,
  blocked:0,
  delivered:0,
  lastStatsAt:0,
  lastSummaryAt:0,
  lastLogAt:0,
  autoFirewall:true
};

const SCENARIOS={
  home:{name:"🏠 Home",desc:"ISP → Router NAT → AP → devices. DHCP, DNS, NAT basics.",nodes:[{id:"i",type:"cloud",x:410,y:50,label:"ISP / Internet",ip:"1.1.1.0/24"},{id:"r",type:"router",x:410,y:148,label:"Home Router",ip:"192.168.1.1"},{id:"a",type:"ap",x:410,y:255,label:"WiFi AP",ip:"192.168.1.2"},{id:"p1",type:"pc",x:195,y:370,label:"Desktop",ip:"192.168.1.10"},{id:"p2",type:"laptop",x:370,y:385,label:"Laptop",ip:"192.168.1.11"},{id:"p3",type:"pc",x:545,y:370,label:"Smart TV",ip:"192.168.1.12"},{id:"d",type:"dns",x:630,y:75,label:"DNS 8.8.8.8",ip:"8.8.8.8"}],edges:[{id:"e1",s:"i",t:"r",l:"WAN PPPoE"},{id:"e2",s:"i",t:"d",l:"DNS"},{id:"e3",s:"r",t:"a",l:"Eth GigE"},{id:"e4",s:"a",t:"p1",l:"2.4GHz"},{id:"e5",s:"a",t:"p2",l:"5GHz"},{id:"e6",s:"a",t:"p3",l:"2.4GHz"}]},
  enterprise:{name:"🏢 Enterprise",desc:"3-zone DMZ: Edge FW → DMZ (public servers) + Core LAN with VLANs.",nodes:[{id:"i",type:"cloud",x:410,y:38,label:"Internet",ip:"0.0.0.0/0"},{id:"fw",type:"ngfw",x:410,y:118,label:"Edge NGFW",ip:"203.0.113.1"},{id:"dr",type:"router",x:195,y:210,label:"DMZ Router",ip:"10.10.0.1"},{id:"cr",type:"l3sw",x:625,y:210,label:"Core L3 SW",ip:"172.16.0.1"},{id:"web",type:"web",x:90,y:320,label:"Web Server",ip:"10.10.0.10"},{id:"mail",type:"server",x:280,y:320,label:"Mail Server",ip:"10.10.0.11"},{id:"sw1",type:"switch",x:625,y:320,label:"Access SW1",ip:null},{id:"v10",type:"pc",x:480,y:430,label:"Finance VLAN10",ip:"172.16.10.5"},{id:"v20",type:"pc",x:630,y:430,label:"HR VLAN20",ip:"172.16.20.5"},{id:"v30",type:"server",x:780,y:430,label:"Files VLAN30",ip:"172.16.30.10"},{id:"dns",type:"dns",x:680,y:118,label:"Internal DNS",ip:"172.16.0.53"}],edges:[{id:"e1",s:"i",t:"fw",l:"WAN"},{id:"e2",s:"fw",t:"dr",l:"DMZ Zone"},{id:"e3",s:"fw",t:"cr",l:"LAN Zone"},{id:"e4",s:"fw",t:"dns",l:"Mgmt"},{id:"e5",s:"dr",t:"web",l:"GigE"},{id:"e6",s:"dr",t:"mail",l:"GigE"},{id:"e7",s:"cr",t:"sw1",l:"10G Trunk"},{id:"e8",s:"sw1",t:"v10",l:"VLAN10"},{id:"e9",s:"sw1",t:"v20",l:"VLAN20"},{id:"e10",s:"sw1",t:"v30",l:"VLAN30"}]},
  vpn:{name:"🔒 VPN",desc:"Site-to-site IPsec VPN. Encrypted tunnel over the public Internet.",nodes:[{id:"i",type:"cloud",x:410,y:52,label:"Internet",ip:"public"},{id:"hq",type:"router",x:185,y:162,label:"HQ Gateway",ip:"203.0.113.1"},{id:"br",type:"router",x:635,y:162,label:"Branch GW",ip:"198.51.100.1"},{id:"sw1",type:"switch",x:185,y:278,label:"HQ Switch",ip:null},{id:"sw2",type:"switch",x:635,y:278,label:"Branch Switch",ip:null},{id:"h1",type:"pc",x:80,y:390,label:"HQ PC 1",ip:"10.1.0.10"},{id:"h2",type:"pc",x:200,y:390,label:"HQ PC 2",ip:"10.1.0.11"},{id:"s1",type:"server",x:320,y:390,label:"HQ Server",ip:"10.1.0.5"},{id:"b1",type:"pc",x:510,y:390,label:"Branch PC1",ip:"10.2.0.10"},{id:"b2",type:"pc",x:635,y:390,label:"Branch PC2",ip:"10.2.0.11"},{id:"b3",type:"pc",x:760,y:390,label:"Branch PC3",ip:"10.2.0.12"}],edges:[{id:"e1",s:"hq",t:"i",l:"WAN"},{id:"e2",s:"br",t:"i",l:"WAN"},{id:"e3",s:"hq",t:"sw1",l:"LAN"},{id:"e4",s:"br",t:"sw2",l:"LAN"},{id:"e5",s:"sw1",t:"h1",l:"Eth"},{id:"e6",s:"sw1",t:"h2",l:"Eth"},{id:"e7",s:"sw1",t:"s1",l:"Eth"},{id:"e8",s:"sw2",t:"b1",l:"Eth"},{id:"e9",s:"sw2",t:"b2",l:"Eth"},{id:"e10",s:"sw2",t:"b3",l:"Eth"}],vpn:["hq","br"]},
  datacenter:{name:"🏗️ Datacenter",desc:"Spine-leaf fabric with load balancer, app tier, and DB cluster.",nodes:[{id:"i",type:"cloud",x:410,y:36,label:"Internet",ip:"0.0.0.0/0"},{id:"fw",type:"ngfw",x:410,y:108,label:"DC Firewall",ip:"10.0.0.1"},{id:"lb",type:"lb",x:410,y:190,label:"Load Balancer",ip:"10.0.1.1"},{id:"sp1",type:"l3sw",x:225,y:278,label:"Spine-1",ip:"10.0.10.1"},{id:"sp2",type:"l3sw",x:595,y:278,label:"Spine-2",ip:"10.0.10.2"},{id:"lf1",type:"switch",x:130,y:378,label:"Leaf-1",ip:null},{id:"lf2",type:"switch",x:320,y:378,label:"Leaf-2",ip:null},{id:"lf3",type:"switch",x:500,y:378,label:"Leaf-3",ip:null},{id:"lf4",type:"switch",x:690,y:378,label:"Leaf-4",ip:null},{id:"a1",type:"web",x:80,y:485,label:"App-1",ip:"10.0.2.11"},{id:"a2",type:"web",x:185,y:485,label:"App-2",ip:"10.0.2.12"},{id:"a3",type:"web",x:270,y:485,label:"App-3",ip:"10.0.2.13"},{id:"a4",type:"web",x:375,y:485,label:"App-4",ip:"10.0.2.14"},{id:"db1",type:"server",x:455,y:485,label:"DB Primary",ip:"10.0.3.11"},{id:"db2",type:"server",x:560,y:485,label:"DB Replica",ip:"10.0.3.12"},{id:"s3",type:"server",x:645,y:485,label:"Cache",ip:"10.0.4.11"},{id:"s4",type:"server",x:750,y:485,label:"Object Store",ip:"10.0.4.12"}],edges:[{id:"e0",s:"i",t:"fw",l:"WAN"},{id:"e1",s:"fw",t:"lb",l:"Filtered"},{id:"e2",s:"lb",t:"sp1",l:"10G"},{id:"e3",s:"lb",t:"sp2",l:"10G"},{id:"e4",s:"sp1",t:"lf1",l:"40G"},{id:"e5",s:"sp1",t:"lf2",l:"40G"},{id:"e6",s:"sp1",t:"lf3",l:"40G"},{id:"e7",s:"sp2",t:"lf2",l:"40G"},{id:"e8",s:"sp2",t:"lf3",l:"40G"},{id:"e9",s:"sp2",t:"lf4",l:"40G"},{id:"e10",s:"lf1",t:"a1",l:"1G"},{id:"e11",s:"lf1",t:"a2",l:"1G"},{id:"e12",s:"lf2",t:"a3",l:"1G"},{id:"e13",s:"lf2",t:"a4",l:"1G"},{id:"e14",s:"lf3",t:"db1",l:"25G"},{id:"e15",s:"lf3",t:"db2",l:"25G"},{id:"e16",s:"lf4",t:"s3",l:"10G"},{id:"e17",s:"lf4",t:"s4",l:"10G"}]},
  hybrid:{name:"☁️ Hybrid Cloud",desc:"On-prem datacenter connected to a cloud VPC with VPN/Direct Connect and a public load balancer.",nodes:[{id:"i",type:"cloud",x:410,y:36,label:"Public Cloud (VPC)",ip:"0.0.0.0/0"},{id:"dc-fw",type:"ngfw",x:300,y:120,label:"On-prem FW",ip:"198.51.100.1"},{id:"vpc-fw",type:"ngfw",x:520,y:120,label:"Cloud FW",ip:"203.0.113.1"},{id:"dc-lb",type:"lb",x:300,y:200,label:"On-prem LB",ip:"10.100.1.10"},{id:"vpc-lb",type:"lb",x:520,y:200,label:"Cloud LB",ip:"34.120.1.10"},{id:"dc-web",type:"web",x:220,y:300,label:"App (On-prem)",ip:"10.100.2.10"},{id:"dc-db",type:"server",x:380,y:300,label:"DB (On-prem)",ip:"10.100.3.11"},{id:"vpc-app1",type:"web",x:440,y:300,label:"Cloud App 1",ip:"10.200.2.11"},{id:"vpc-db",type:"server",x:600,y:300,label:"Cloud DB",ip:"10.200.3.11"}],edges:[{id:"e1",s:"dc-fw",t:"vpc-fw",l:"IPsec VPN / Direct"},{id:"e2",s:"dc-fw",t:"dc-lb",l:"Uplink"},{id:"e3",s:"vpc-fw",t:"vpc-lb",l:"Cloud Uplink"},{id:"e4",s:"dc-lb",t:"dc-web",l:"1G"},{id:"e5",s:"dc-lb",t:"dc-db",l:"1G"},{id:"e6",s:"vpc-lb",t:"vpc-app1",l:"10G"},{id:"e7",s:"vpc-lb",t:"vpc-db",l:"10G"}]},
  wan:{name:"🌐 WAN/BGP",desc:"3-site MPLS WAN with BGP routing between Autonomous Systems.",nodes:[{id:"mpls",type:"cloud",x:410,y:44,label:"MPLS Core",ip:"AS65000"},{id:"pe1",type:"router",x:165,y:152,label:"HQ PE (AS65001)",ip:"10.255.1.1"},{id:"pe2",type:"router",x:410,y:215,label:"Br1 PE (AS65002)",ip:"10.255.2.1"},{id:"pe3",type:"router",x:655,y:152,label:"Br2 PE (AS65003)",ip:"10.255.3.1"},{id:"fw1",type:"firewall",x:165,y:270,label:"HQ Firewall",ip:"10.1.0.1"},{id:"sw1",type:"l3sw",x:165,y:370,label:"HQ Core SW",ip:"10.1.0.2"},{id:"h1",type:"pc",x:62,y:462,label:"HQ PC1",ip:"10.1.0.10"},{id:"h2",type:"pc",x:175,y:462,label:"HQ PC2",ip:"10.1.0.11"},{id:"s1",type:"server",x:288,y:462,label:"HQ Server",ip:"10.1.0.5"},{id:"sw2",type:"switch",x:410,y:335,label:"Br1 Switch",ip:null},{id:"b1",type:"pc",x:318,y:445,label:"Br1 PC1",ip:"10.2.0.10"},{id:"b2",type:"pc",x:500,y:445,label:"Br1 PC2",ip:"10.2.0.11"},{id:"sw3",type:"switch",x:655,y:270,label:"Br2 Switch",ip:null},{id:"c1",type:"pc",x:568,y:378,label:"Br2 PC1",ip:"10.3.0.10"},{id:"c2",type:"pc",x:742,y:378,label:"Br2 PC2",ip:"10.3.0.11"}],edges:[{id:"e1",s:"mpls",t:"pe1",l:"MPLS P2P"},{id:"e2",s:"mpls",t:"pe2",l:"MPLS P2P"},{id:"e3",s:"mpls",t:"pe3",l:"MPLS P2P"},{id:"e4",s:"pe1",t:"fw1",l:"WAN GW"},{id:"e5",s:"fw1",t:"sw1",l:"Trunk"},{id:"e6",s:"sw1",t:"h1",l:"Eth"},{id:"e7",s:"sw1",t:"h2",l:"Eth"},{id:"e8",s:"sw1",t:"s1",l:"Eth"},{id:"e9",s:"pe2",t:"sw2",l:"GigE"},{id:"e10",s:"sw2",t:"b1",l:"Eth"},{id:"e11",s:"sw2",t:"b2",l:"Eth"},{id:"e12",s:"pe3",t:"sw3",l:"GigE"},{id:"e13",s:"sw3",t:"c1",l:"Eth"},{id:"e14",s:"sw3",t:"c2",l:"Eth"}]},
  ospf:{name:"📍 OSPF",desc:"OSPF multi-area: backbone Area 0 with Areas 1 and 2 attached via ABRs.",nodes:[{id:"bb1",type:"router",x:300,y:95,label:"Backbone R1",ip:"10.0.0.1"},{id:"bb2",type:"router",x:520,y:95,label:"Backbone R2",ip:"10.0.0.2"},{id:"abr1",type:"router",x:165,y:220,label:"ABR Area0/1",ip:"10.0.1.1"},{id:"abr2",type:"router",x:655,y:220,label:"ABR Area0/2",ip:"10.0.2.1"},{id:"r1a",type:"router",x:80,y:345,label:"Area1 R-A",ip:"10.1.0.1"},{id:"r1b",type:"router",x:250,y:345,label:"Area1 R-B",ip:"10.1.0.2"},{id:"r2a",type:"router",x:570,y:345,label:"Area2 R-A",ip:"10.2.0.1"},{id:"r2b",type:"router",x:740,y:345,label:"Area2 R-B",ip:"10.2.0.2"},{id:"n1",type:"pc",x:80,y:450,label:"Net 10.1.1.0",ip:"10.1.1.x"},{id:"n2",type:"pc",x:250,y:450,label:"Net 10.1.2.0",ip:"10.1.2.x"},{id:"n3",type:"pc",x:570,y:450,label:"Net 10.2.1.0",ip:"10.2.1.x"},{id:"n4",type:"pc",x:740,y:450,label:"Net 10.2.2.0",ip:"10.2.2.x"}],edges:[{id:"e1",s:"bb1",t:"bb2",l:"Area 0"},{id:"e2",s:"bb1",t:"abr1",l:"Area 0"},{id:"e3",s:"bb2",t:"abr2",l:"Area 0"},{id:"e4",s:"abr1",t:"r1a",l:"Area 1"},{id:"e5",s:"abr1",t:"r1b",l:"Area 1"},{id:"e6",s:"abr2",t:"r2a",l:"Area 2"},{id:"e7",s:"abr2",t:"r2b",l:"Area 2"},{id:"e8",s:"r1a",t:"n1",l:"LAN"},{id:"e9",s:"r1b",t:"n2",l:"LAN"},{id:"e10",s:"r2a",t:"n3",l:"LAN"},{id:"e11",s:"r2b",t:"n4",l:"LAN"}]},
  spanning:{name:"🔁 STP",desc:"Spanning Tree Protocol: redundant switch topology, root bridge election, blocked ports.",nodes:[{id:"r",type:"router",x:410,y:48,label:"Router",ip:"10.0.0.1"},{id:"root",type:"switch",x:410,y:142,label:"Root Bridge SW0",ip:"Priority 0"},{id:"sw1",type:"switch",x:205,y:258,label:"SW1 (Non-Root)",ip:"Prio 32768"},{id:"sw2",type:"switch",x:615,y:258,label:"SW2 (Non-Root)",ip:"Prio 32768"},{id:"sw3",type:"switch",x:105,y:375,label:"SW3",ip:"Prio 32768"},{id:"sw4",type:"switch",x:310,y:375,label:"SW4",ip:"Prio 32768"},{id:"sw5",type:"switch",x:510,y:375,label:"SW5",ip:"Prio 32768"},{id:"sw6",type:"switch",x:715,y:375,label:"SW6",ip:"Prio 32768"},{id:"h1",type:"pc",x:55,y:480,label:"PC1",ip:"10.0.1.10"},{id:"h2",type:"pc",x:160,y:480,label:"PC2",ip:"10.0.1.11"},{id:"h3",type:"pc",x:260,y:480,label:"PC3",ip:"10.0.2.10"},{id:"h4",type:"pc",x:365,y:480,label:"PC4",ip:"10.0.2.11"},{id:"h5",type:"pc",x:460,y:480,label:"PC5",ip:"10.0.3.10"},{id:"h6",type:"pc",x:565,y:480,label:"PC6",ip:"10.0.3.11"},{id:"h7",type:"pc",x:665,y:480,label:"PC7",ip:"10.0.4.10"},{id:"h8",type:"pc",x:770,y:480,label:"PC8",ip:"10.0.4.11"}],edges:[{id:"e0",s:"r",t:"root",l:"Uplink"},{id:"e1",s:"root",t:"sw1",l:"Designated"},{id:"e2",s:"root",t:"sw2",l:"Designated"},{id:"e3",s:"sw1",t:"sw2",l:"[BLK] STP Block"},{id:"e4",s:"sw1",t:"sw3",l:"Designated"},{id:"e5",s:"sw1",t:"sw4",l:"Designated"},{id:"e6",s:"sw2",t:"sw5",l:"Designated"},{id:"e7",s:"sw2",t:"sw6",l:"Designated"},{id:"e8",s:"sw3",t:"h1",l:"Access"},{id:"e9",s:"sw3",t:"h2",l:"Access"},{id:"e10",s:"sw4",t:"h3",l:"Access"},{id:"e11",s:"sw4",t:"h4",l:"Access"},{id:"e12",s:"sw5",t:"h5",l:"Access"},{id:"e13",s:"sw5",t:"h6",l:"Access"},{id:"e14",s:"sw6",t:"h7",l:"Access"},{id:"e15",s:"sw6",t:"h8",l:"Access"}]}
};

const ROUTING_TABLES={
  home:[["0.0.0.0/0","via WAN ISP","S*","1"],["192.168.1.0/24","Connected LAN","C","0"],["8.8.8.8/32","via WAN ISP","S","1"]],
  enterprise:[["0.0.0.0/0","via ISP","S*","1"],["10.10.0.0/24","via DMZ iface","C","0"],["172.16.0.0/16","via LAN iface","C","0"],["203.0.113.0/24","eBGP peer","B","20"]],
  vpn:[["10.1.0.0/24","Loopback","C","0"],["10.2.0.0/24","via IPsec tunnel","S","1"],["0.0.0.0/0","via ISP WAN","S*","1"]],
  wan:[["10.1.0.0/16","Connected","C","0"],["10.2.0.0/16","via MPLS","L","1"],["10.3.0.0/16","via MPLS","L","1"],["0.0.0.0/0","via Tier1 BGP","B","20"]]
};

const VLANS={
  enterprise:[{id:1,name:"Native/Mgmt",c:"#64748b",ports:"All uplinks"},{id:10,name:"Finance",c:"#3b82f6",ports:"SW1 Fa0/1-10"},{id:20,name:"HR",c:"#10b981",ports:"SW1 Fa0/11-20"},{id:30,name:"Servers",c:"#f59e0b",ports:"SW1 Fa0/21-24"},{id:99,name:"DMZ",c:"#ef4444",ports:"Uplink to FW"}],
  datacenter:[{id:10,name:"App Servers",c:"#06b6d4",ports:"Leaf1-2 all"},{id:20,name:"Database",c:"#8b5cf6",ports:"Leaf3 all"},{id:30,name:"Storage",c:"#f97316",ports:"Leaf4 all"},{id:100,name:"Management",c:"#64748b",ports:"All spines"}],
  default:[{id:1,name:"Default VLAN",c:"#64748b",ports:"All ports"},{id:10,name:"Users",c:"#3b82f6",ports:"Access ports"},{id:20,name:"Servers",c:"#10b981",ports:"Trunk ports"}]
};

const TCP_STEPS=[
  {from:"→",flags:"SYN",desc:"Client sends synchronize. Sets SYN=1, random Seq=1000, ACK=0.",detail:"The client initiates by sending a TCP segment with the SYN flag set. It picks a random Initial Sequence Number (ISN) — e.g. 1000. The ACK flag is 0 because there's nothing to acknowledge yet. The server must be in LISTEN state on the destination port."},
  {from:"←",flags:"SYN-ACK",desc:"Server acknowledges and sends its own SYN. Seq=5000, ACK=1001.",detail:"The server responds with SYN=1 and ACK=1 (both set). It acknowledges the client's ISN by setting ACK number = client ISN + 1 = 1001. It also chooses its own random ISN (e.g. 5000). Server enters SYN-RECEIVED state."},
  {from:"→",flags:"ACK",desc:"Client acknowledges server's SYN. Connection ESTABLISHED on both sides.",detail:"Client sets ACK=1, SYN=0. ACK number = server ISN + 1 = 5001. Both sides are now in ESTABLISHED state. They have agreed on sequence numbers for reliable ordered delivery."},
  {from:"→",flags:"DATA",desc:"Client sends data (e.g. 'GET / HTTP/1.1'). Seq=1001.",detail:"Data is carried in the TCP payload. The sender increments its Seq number by the number of bytes sent. The receiver must ACK each byte. If ACK is not received within RTO, the segment is retransmitted. Window size controls bytes in-flight."},
  {from:"←",flags:"ACK+DATA",desc:"Server ACKs client data and sends HTTP 200 response.",detail:"The server ACKs the received data and may send its response in the same segment (piggybacking). HTTP/2 and QUIC multiplex many streams over one connection to avoid head-of-line blocking."},
  {from:"→",flags:"FIN",desc:"Client initiates graceful teardown. Sends FIN to close its half.",detail:"Active closer sends FIN. Passive closer sends ACK (half-close). Passive closer then sends its own FIN when done sending. Active closer ACKs. This is the 4-way teardown."},
  {from:"←",flags:"FIN-ACK",desc:"Server ACKs FIN and sends its own FIN. Connection fully closed.",detail:"Server sends FIN+ACK. Client ACKs the server's FIN. Both sides free connection state. TIME_WAIT state keeps the port busy for 2×MSL (~60-120s) to absorb stale packets."}
];

/* ── State ── */
let nodes=[],edges=[],pkts=[],logs=[];
let selN=null,selE=null,addMode=null,connMode=false,connStart=null;
let drag=null,doff={x:0,y:0};
let running=true,speed=1,pktId=0,lastSpawn=0,pps=0,ppsCount=0,lastPps=0;
let activeTab="info",activeSc="home";
let selProto="ICMP";
let selectedLinkType="auto";
let resizeMode=null;
let resizeStartX=0;
let resizeStartLeft=0;
let resizeStartRight=0;

const svg=document.getElementById("ns");
const el=document.getElementById("el"),pl=document.getElementById("pl"),nl=document.getElementById("nl");

const LEFT_KEY="netlab.sidebar.left";
const RIGHT_KEY="netlab.sidebar.right";

function clamp(v,min,max){return Math.max(min,Math.min(max,v));}

function sidebarBounds(){
  const vw=window.innerWidth||1200;
  const leftMin=Math.max(72,Math.min(110,Math.round(vw*0.18)));
  const rightMin=Math.max(92,Math.min(220,Math.round(vw*0.20)));
  const leftMax=Math.max(leftMin,Math.min(260,Math.round(vw*0.42)));
  const rightMax=Math.max(rightMin,Math.min(360,Math.round(vw*0.48)));
  return {leftMin,rightMin,leftMax,rightMax};
}

function readStoredWidth(key,fallback){
  const raw=Number(localStorage.getItem(key));
  return Number.isFinite(raw)&&raw>0?raw:fallback;
}

function applySidebarWidths(left,right){
  const root=document.documentElement;
  root.style.setProperty("--left-w",`${left}px`);
  root.style.setProperty("--right-w",`${right}px`);
  const l=document.getElementById("l-resize"),r=document.getElementById("r-resize");
  if(l)l.setAttribute("aria-valuenow",String(Math.round(left)));
  if(r)r.setAttribute("aria-valuenow",String(Math.round(right)));
  localStorage.setItem(LEFT_KEY,String(left));
  localStorage.setItem(RIGHT_KEY,String(right));
}

function initSidebarWidths(){
  const {leftMin,rightMin,leftMax,rightMax}=sidebarBounds();
  const left=clamp(readStoredWidth(LEFT_KEY,148),leftMin,leftMax);
  const right=clamp(readStoredWidth(RIGHT_KEY,286),rightMin,rightMax);
  applySidebarWidths(left,right);
}

function beginResize(side,e){
  resizeMode=side;
  resizeStartX=e.clientX;
  resizeStartLeft=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--left-w"))||148;
  resizeStartRight=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--right-w"))||286;
  document.body.style.userSelect="none";
  document.body.style.cursor="col-resize";
}

function moveResize(e){
  if(!resizeMode)return;
  const dx=e.clientX-resizeStartX;
  const {leftMin,minRight,maxLeft,maxRight}=(()=>{ const b=sidebarBounds(); return {leftMin:b.leftMin,minRight:b.rightMin,maxLeft:b.leftMax,maxRight:b.rightMax}; })();
  if(resizeMode==="left"){
    const left=clamp(resizeStartLeft+dx,leftMin,maxLeft);
    applySidebarWidths(left,parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--right-w"))||resizeStartRight);
  }else if(resizeMode==="right"){
    const right=clamp(resizeStartRight-dx,minRight,maxRight);
    applySidebarWidths(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--left-w"))||resizeStartLeft,right);
  }
}

function endResize(){
  if(!resizeMode)return;
  resizeMode=null;
  document.body.style.userSelect="";
  document.body.style.cursor="";
}

function inferLinkType(a,b,label=""){
  const text=`${label} ${a?.type||""} ${b?.type||""}`.toLowerCase();
  if(/2\.4|wifi24|wireless|ap/.test(text))return"wifi24";
  if(/5ghz|wifi5/.test(text))return"wifi5";
  if(/dns/.test(text))return"dns";
  if(/vpn|ipsec/.test(text))return"vpn";
  if(/mpls|wan|internet|pppoe|cloud/.test(text))return"wan";
  if(/trunk|lacp|vlan/.test(text))return"trunk";
  if(/fiber|10g|25g|40g|gig|uplink|backbone|spine|leaf/.test(text))return"fiber";
  if(a?.type==="cloud"||b?.type==="cloud")return"wan";
  if(a?.type==="ap"||b?.type==="ap")return"wifi24";
  if(a?.type==="dns"||b?.type==="dns")return"dns";
  if(a?.type==="switch"||b?.type==="switch"||a?.type==="l3sw"||b?.type==="l3sw")return"trunk";
  return"ethernet";
}

function edgePreset(type){return LINK_PRESETS[type]||LINK_PRESETS.ethernet;}

function normalizeEdge(e,a,b){
  const type=e.type&&LINK_PRESETS[e.type]?e.type:inferLinkType(a,b,e.l||e.label||"");
  const p=edgePreset(type);
  const label=e.label||e.l||p.label;
  return{...e,type,label,l:label,bw:e.bw??p.bw,lat:e.lat??p.lat,medium:e.medium||p.medium,duplex:e.duplex||p.duplex,color:e.color||p.c,dash:e.dash||p.dash,stroke:e.stroke||p.stroke};
}

function createEdge(s,t,type=selectedLinkType){
  const a=nodes.find(n=>n.id===s),b=nodes.find(n=>n.id===t);
  const actual=type==="auto"?inferLinkType(a,b):type;
  const p=edgePreset(actual);
  return{ id:`e${Date.now()}${Math.floor(Math.random()*1000)}`, s, t, type:actual, label:p.label, l:p.label, bw:p.bw, lat:p.lat, medium:p.medium, duplex:p.duplex, color:p.c, dash:p.dash, stroke:p.stroke };
}

function nodeById(id){return nodes.find(n=>n.id===id);}
function edgeByNodes(a,b){return edges.find(e=>(e.s===a&&e.t===b)||(e.s===b&&e.t===a));}
function edgeKey(a,b){return[a,b].sort().join("|");}
function currentProfile(){return SIM_PROFILES[LAB_STATE.profile]||SIM_PROFILES.normal;}
function firewallNode(n){return n&&(n.type==="firewall"||n.type==="ngfw");}
function hostNodes(){return nodes.filter(n=>["pc","laptop","server","web","lb","dns"].includes(n.type));}
function sourcePool(excludeId){return hostNodes().filter(n=>n.id!==excludeId);}
function trafficLabel(flow){return flow.label||LAB_PRESETS[flow.kind]?.label||flow.kind||"Traffic";}
function addFlow(flow){
  LAB_STATE.flows.push({...flow,id:flow.id||`flow-${Date.now()}-${Math.floor(Math.random()*1000)}`,tokens:0,active:true,started:performance.now()});
  return LAB_STATE.flows[LAB_STATE.flows.length-1];
}
function applyProfile(key,announce=true){
  if(!SIM_PROFILES[key])return;
  LAB_STATE.profile=key;
  if(announce)addLog(`🧪 Network profile: ${SIM_PROFILES[key].label} — ${SIM_PROFILES[key].desc}`,"info");
  renderHUD();
  renderRight();
}
function pickScenarioEndPoints(kind){
  const hosts=hostNodes();
  const servers=nodes.filter(n=>["server","web","lb","dns"].includes(n.type));
  const firewalls=nodes.filter(firewallNode);
  const internet=nodes.filter(n=>n.type==="cloud");
  const firstHost=hosts[0]||nodes[0];
  const secondHost=hosts.find(n=>n.id!==firstHost?.id)||hosts[1]||firstHost;
  const server=servers[0]||secondHost||firstHost;
  const fw=firewalls[0]||server;
  const wan=internet[0]||fw;
  if(kind==="voip"||kind==="stream")return {src:firstHost,dst:secondHost||server};
  if(kind==="dos")return {src:firstHost,dst:server||fw};
  if(kind==="ddos"||kind==="syn"||kind==="dnsamp")return {src:wan,dst:server||fw};
  return {src:firstHost,dst:server||secondHost};
}
function startLabFlow(kind,overrides={}){
  const preset=LAB_PRESETS[kind];
  if(!preset)return null;
  const endpoints=pickScenarioEndPoints(kind);
  const src=overrides.src||endpoints.src;
  const dst=overrides.dst||endpoints.dst;
  if(!src||!dst||src.id===dst.id)return null;
  const flow={
    kind,
    label:overrides.label||preset.label,
    proto:overrides.proto||preset.proto,
    rate:overrides.rate||preset.rate,
    size:overrides.size||preset.size,
    attack:overrides.attack??preset.attack,
    srcId:src.id,
    dstId:dst.id,
    distributed:overrides.distributed||false,
    sourcePool:overrides.sourcePool||sourcePool(dst.id),
    ttl:overrides.ttl||64,
    port:overrides.port||null,
    burst:overrides.burst||1,
    color:overrides.color||PR[preset.proto]?.c||"#fff",
    meta:overrides.meta||{}
  };
  addFlow(flow);
  addLog(`▶ ${trafficLabel(flow)} ${src.label} → ${dst.label}`,(flow.attack?"warn":"packet"));
  return flow;
}
function stopAllLabFlows(){
  LAB_STATE.flows=[];
  addLog("🛑 Lab traffic stopped","warn");
  renderRight();
}
function firewallVerdict(node,pkt){
  if(!firewallNode(node))return true;
  if(!pkt.attack&&pkt.kind!=="dos"&&pkt.kind!=="ddos"&&pkt.kind!=="syn-flood"&&pkt.kind!=="dns-amplification")return true;
  const strict=node.type==="ngfw";
  const profile=currentProfile();
  const attackBias=pkt.kind==="ddos"?0.52:pkt.kind==="syn-flood"?0.36:pkt.kind==="dns-amplification"?0.4:0.28;
  const loadBias=clamp((pkt.edgeLoad||0)/12,0,0.42);
  const profileBias=profile.loss>0.03?0.08:0;
  const threshold=strict?0.84:0.64;
  const score=threshold-(attackBias+loadBias+profileBias)+(Math.random()*0.18);
  const allow=score>0.18;
  if(!allow){
    LAB_STATE.blocked++;
    const now=performance.now();
    if(now-LAB_STATE.lastLogAt>1000){
      addLog(`🛡️ ${node.label} blocked ${pkt.kind.toUpperCase()} traffic`,"warn");
      LAB_STATE.lastLogAt=now;
    }
  }
  return allow;
}
function edgeMetrics(edge){
  const preset=edgePreset(edge?.type||"ethernet");
  const profile=currentProfile();
  const bw=Math.max(8,(edge?.bw||preset.bw)*profile.bwScale*(edge?.type==="wifi24"?0.8:edge?.type==="wifi5"?0.95:1));
  const lat=Math.max(1,(edge?.lat||preset.lat)+profile.latAdd+(edge?.type==="wifi24"?12:edge?.type==="wifi5"?5:0));
  const loss=clamp((edge?.loss??preset.loss??0)+profile.loss+(edge?.type==="wifi24"?0.04:edge?.type==="wifi5"?0.02:0),0,0.95);
  return {bw,lat,loss};
}
function edgePressure(map,edge,pkt){
  const k=edgeKey(edge.s,edge.t);
  const info=map.get(k)||{count:0,bytes:0,attack:0};
  info.count++;
  info.bytes+=pkt.size||900;
  if(pkt.attack)info.attack++;
  map.set(k,info);
  return info;
}
function packetMoveFactor(edge,pressure,pkt){
  const q=edgeMetrics(edge);
  const capacity=Math.max(1,q.bw*0.18);
  const load=Math.max(0,pressure.bytes/capacity-1);
  const jitter=(Math.random()*q.lat*0.12)+(pkt.kind==="voip"?Math.random()*1.4:0);
  const duplexPenalty=(edge?.duplex==="half"&&pressure.count>1)?0.28:0;
  const sizePenalty=clamp((pkt.size||900)/1400,0.35,1.35);
  const base=0.22+q.bw/25000;
  const slow=(1+q.lat/22+load*0.85+duplexPenalty+jitter/60)*sizePenalty;
  return {step:base/slow, loss:q.loss, load, jitterMs:jitter, metrics:q};
}
function spawnFlowPacket(flow){
  const src=flow.distributed&&flow.sourcePool?.length?flow.sourcePool[Math.floor(Math.random()*flow.sourcePool.length)]:nodeById(flow.srcId);
  const dst=nodeById(flow.dstId);
  if(!src||!dst||src.id===dst.id)return;
  const p=bfs(src.id,dst.id);
  if(!p||p.length<2)return;
  pkts.push({id:`pk${pktId++}`,path:p,seg:0,t:0,proto:flow.proto,c:flow.color,size:flow.size,kind:flow.kind,attack:flow.attack,flowId:flow.id,ttl:flow.ttl,label:flow.label,source:src.id,target:dst.id,age:0,delay:0});
  ppsCount++;
}
function spawnLabTraffic(dt){
  for(const flow of LAB_STATE.flows){
    if(!flow.active)continue;
    flow.tokens+=(flow.rate*dt*speed);
    const burstCap=Math.max(1,flow.burst||1);
    let launched=0;
    while(flow.tokens>=1&&launched<burstCap){
      spawnFlowPacket(flow);
      flow.tokens-=1;
      launched++;
    }
  }
}

function svgPt(e){const r=svg.getBoundingClientRect();return{x:(e.clientX-r.left)*(820/r.width),y:(e.clientY-r.top)*(580/r.height)};}
function mkSVG(tag,a){const e=document.createElementNS("http://www.w3.org/2000/svg",tag);for(const[k,v]of Object.entries(a))e.setAttribute(k,v);return e;}

function bfs(s,t){
  const adj={};nodes.forEach(n=>{adj[n.id]=[];});
  edges.forEach(e=>{adj[e.s]?.push(e.t);adj[e.t]?.push(e.s);});
  const vis=new Set([s]);const q=[[s,[s]]];
  while(q.length){const[c,p]=q.shift();if(c===t)return p;for(const nb of(adj[c]||[])){if(!vis.has(nb)){vis.add(nb);q.push([nb,[...p,nb]]);}}}
  return null;
}

function spawn(s,t,proto){const p=bfs(s,t);if(!p||p.length<2)return;pkts.push({id:`pk${pktId++}`,path:p,seg:0,t:0,proto,c:PR[proto]?.c||"#fff"});ppsCount++;}

function loadSc(key){
  const s=SCENARIOS[key];if(!s)return;
  activeSc=key;nodes=s.nodes.map(n=>({...n}));edges=s.edges.map(e=>({...e}));
  edges=edges.map(e=>normalizeEdge(e,nodes.find(n=>n.id===e.s),nodes.find(n=>n.id===e.t)));
  pkts=[];selN=null;selE=null;LAB_STATE.flows=[];LAB_STATE.totalDrops=0;LAB_STATE.blocked=0;LAB_STATE.delivered=0;LAB_STATE.lastLogAt=0;
  addLog(`▶ ${s.name}`,"ok");
  render();
  document.querySelectorAll(".sc-btn").forEach(b=>b.classList.toggle("active",b.dataset.k===key));
  renderRight();
}

function renderEdges(){
  el.innerHTML="";
  const vpnIds=SCENARIOS[activeSc]?.vpn||[];
  for(const e of edges){
    const s=nodes.find(n=>n.id===e.s),t=nodes.find(n=>n.id===e.t);if(!s||!t)continue;
    const p=edgePreset(e.type||inferLinkType(s,t,e.l));
    const isSel=selE===e.id,isVPN=vpnIds.includes(e.s)&&vpnIds.includes(e.t),isBlk=e.l.includes("[BLK]");
    const active=pkts.some(p=>{const a=p.path[p.seg],b=p.path[p.seg+1];return(a===e.s&&b===e.t)||(a===e.t&&b===e.s);});
    const g=document.createElementNS("http://www.w3.org/2000/svg","g");g.style.cursor="pointer";
    const stroke=e.color||p.c;
    const dash=e.dash||p.dash||((isVPN&&e.type!=="vpn")?"7 3":"none");
    const width=e.stroke||p.stroke||1.7;
    const hit=mkSVG("line",{x1:s.x,y1:s.y,x2:t.x,y2:t.y,stroke:"rgba(0,0,0,0)","stroke-width":14,"pointer-events":"stroke"});
    const line=mkSVG("line",{x1:s.x,y1:s.y,x2:t.x,y2:t.y,stroke:isSel?"#00ddff":isBlk?"#ff4455":active?"#bfeaff":stroke,"stroke-width":isSel?Math.max(2.8,width+0.4):width, "stroke-dasharray":isBlk?"4 4":dash,opacity:isBlk?0.55:0.95});
    g.appendChild(hit);
    g.appendChild(line);
    const mx=(s.x+t.x)/2,my=(s.y+t.y)/2;
    const lbl=e.label||e.l||p.label;
    const bg=mkSVG("rect",{x:mx-Math.max(18,lbl.length*2.8)-2,y:my-8,width:Math.max(36,lbl.length*5.6)+4,height:12,fill:"#060c18",rx:1,opacity:0.95});
    const txt=mkSVG("text",{x:mx,y:my+1,"text-anchor":"middle","font-size":"7","fill":isBlk?"#ff4455":isVPN?"#ffc700":stroke,"font-family":"monospace"});
    txt.textContent=lbl;g.appendChild(bg);g.appendChild(txt);
    g.addEventListener("click",ev=>{ev.stopPropagation();selE=e.id;selN=null;render();renderRight();});
    el.appendChild(g);
  }
}

function renderNodes(){
  nl.innerHTML="";
  for(const n of nodes){
    const dev=D[n.type]||D.pc;const isSel=selN===n.id,isCStart=connStart===n.id;
    const g=document.createElementNS("http://www.w3.org/2000/svg","g");g.style.cursor=drag===n.id?"grabbing":"grab";
    // Accessibility: provide a title for screen readers
    const ttl=mkSVG('title',{});
    ttl.textContent = n.label + (n.ip?(' — '+n.ip):'');
    g.appendChild(ttl);
    if(isSel||isCStart){const ring=mkSVG("circle",{cx:n.x,cy:n.y,r:30,fill:"none",stroke:isCStart?"#00ff88":"#00ddff","stroke-width":1.5,"stroke-dasharray":"5 3",opacity:0.7});g.appendChild(ring);}
    const circle=mkSVG("circle",{cx:n.x,cy:n.y,r:22,fill:isSel?"#0a1e38":"#060c18",stroke:dev.c,"stroke-width":isSel?2:1.2,opacity:isSel?1:0.9});g.appendChild(circle);
    const icon=mkSVG("text",{x:n.x,y:n.y+5,"text-anchor":"middle","font-size":"13","dominant-baseline":"middle"});
    icon.style.pointerEvents="none";icon.textContent=dev.i;g.appendChild(icon);
    // add a small background rect behind the label so accessibility tools can determine contrast
    const lblWidth = Math.max(60, (n.label||'').length * 6);
    const lblBg = mkSVG("rect",{x:n.x - lblWidth/2,y:n.y+24,width:lblWidth,height:12,fill:'#060c18',rx:2});
    lblBg.style.pointerEvents = 'none';
    g.appendChild(lblBg);
    const lbl=mkSVG("text",{x:n.x,y:n.y+34,"text-anchor":"middle","font-size":"8","fill":isSel?"#a8bdd4":"#bfeaff","font-family":"monospace"});lbl.style.pointerEvents="none";lbl.textContent=n.label;g.appendChild(lbl);
    if(n.ip){
      const ipWidth = Math.max(50, (n.ip||'').length * 6);
      const ipBg = mkSVG("rect",{x:n.x - ipWidth/2,y:n.y+34,width:ipWidth,height:12,fill:'#060c18',rx:2});
      ipBg.style.pointerEvents='none';
      g.appendChild(ipBg);
      const ip=mkSVG("text",{x:n.x,y:n.y+44,"text-anchor":"middle","font-size":"7","fill":"#9bd0ff","font-family":"monospace"});ip.style.pointerEvents="none";ip.textContent=n.ip;g.appendChild(ip);
    }    
    g.addEventListener("mousedown",ev=>{ev.stopPropagation();handleDown(ev,n.id);});
    nl.appendChild(g);
  }
}

function renderPkts(){
  pl.innerHTML="";
  for(const p of pkts){
    const s=nodes.find(n=>n.id===p.path[p.seg]),t=nodes.find(n=>n.id===p.path[p.seg+1]);if(!s||!t)continue;
    const px=s.x+(t.x-s.x)*p.t,py=s.y+(t.y-s.y)*p.t;
    const outer=mkSVG("circle",{cx:px,cy:py,r:6,fill:p.c,opacity:0.12});
    const inner=mkSVG("circle",{cx:px,cy:py,r:3,fill:p.c,opacity:0.95});
    const lbl=mkSVG("text",{x:px,y:py-7,"text-anchor":"middle","font-size":"6","fill":p.c,"font-family":"monospace"});lbl.textContent=p.proto;
    const gg=mkSVG("g",{});gg.classList.add('pkt');gg.appendChild(outer);gg.appendChild(inner);gg.appendChild(lbl);pl.appendChild(gg);
  }
}

function render(){renderEdges();renderNodes();renderHUD();}
function renderHUD(){
  document.getElementById("h-pkts").textContent=`📦 ${pkts.length}`;
  document.getElementById("h-topo").textContent=`🖧 ${nodes.length}N ${edges.length}L`;
  document.getElementById("h-bw").textContent=`↑ ${pps} pps`;
  const sample=LAB_STATE.delivered+LAB_STATE.totalDrops;
  const lossNow=sample<5?0:Math.round((LAB_STATE.totalDrops/sample)*100);
  const avgFlow=LAB_STATE.flows.length||0;
  const avgDelay=Math.round(pkts.reduce((a,p)=>a+(p.delay||0),0)/Math.max(1,pkts.length));
  const hLoss=document.getElementById("h-loss");
  const hLat=document.getElementById("h-lat");
  const hLab=document.getElementById("h-lab");
  if(hLoss)hLoss.textContent=`⚠ ${lossNow}% loss`;
  if(hLat)hLat.textContent=`⏱ ${avgDelay} ms`;
  if(hLab)hLab.textContent=`🧪 ${avgFlow} flows`;
}

function handleDown(e,id){
  if(connMode){
    if(!connStart){connStart=id;renderNodes();updateHints();return;}
    if(connStart!==id){
      const sn=nodes.find(n=>n.id===connStart),tn=nodes.find(n=>n.id===id);
      const edge=createEdge(connStart,id,selectedLinkType);
      edges.push(edge);
      addLog(`🔗 ${sn?.label} ↔ ${tn?.label} (${edge.label})`,"ok");
      connStart=null;
      updateConnBtn();
      updateHints();
      render();
      renderRight();
      return;
    }
    return;
  }
  selN=id;selE=null;drag=id;const nd=nodes.find(n=>n.id===id);const pt=svgPt(e);doff={x:pt.x-nd.x,y:pt.y-nd.y};render();renderRight();
}

svg.addEventListener("mousemove",e=>{if(!drag)return;const pt=svgPt(e);const nd=nodes.find(n=>n.id===drag);if(nd){nd.x=Math.max(25,Math.min(795,pt.x-doff.x));nd.y=Math.max(25,Math.min(555,pt.y-doff.y));}render();});
svg.addEventListener("mouseup",()=>{drag=null;});
svg.addEventListener("mouseleave",()=>{drag=null;});
svg.addEventListener("click",e=>{
  const bg=e.target===svg||e.target.tagName==="rect"||e.target.tagName==="pattern";
  if(addMode&&bg){const pt=svgPt(e);const id=`n${Date.now()}`;nodes.push({id,type:addMode,x:pt.x,y:pt.y,label:D[addMode]?.l||addMode,ip:null});addLog(`+ ${D[addMode]?.l}`,"ok");addMode=null;updateDevBtns();updateHints();svg.className.baseVal="";render();renderRight();return;}
  if(!addMode){selN=null;selE=null;if(connMode&&connStart){connMode=false;connStart=null;updateConnBtn();updateHints();svg.className.baseVal="";}render();renderRight();}
});

let lastTs=0;
function loop(ts){
  requestAnimationFrame(loop);
  const dt=Math.min((ts-lastTs)/1000,0.1);lastTs=ts;
  if(ts-lastPps>1000){pps=ppsCount;ppsCount=0;lastPps=ts;renderHUD();}
  if(!running){renderPkts();return;}
  spawnLabTraffic(dt);
  if(ts-lastSpawn>900/speed&&nodes.length>=2&&LAB_STATE.flows.length<1){
    lastSpawn=ts;
    const src=nodes[Math.floor(Math.random()*nodes.length)];
    const others=nodes.filter(n=>n.id!==src.id);
    if(others.length){
      const tgt=others[Math.floor(Math.random()*others.length)];
      const ps=Object.keys(PR);
      spawn(src.id,tgt.id,ps[Math.floor(Math.random()*ps.length)]);
    }
  }
  const pressureMap=new Map();
  for(const pkt of pkts){
    const a=nodeById(pkt.path[pkt.seg]),b=nodeById(pkt.path[pkt.seg+1]);
    if(a&&b&&edgeByNodes(a.id,b.id))edgePressure(pressureMap,edgeByNodes(a.id,b.id),pkt);
  }
  const dead=[];
  for(let i=0;i<pkts.length;i++){
    const pkt=pkts[i];
    pkt.age+=(dt*speed);
    const a=nodeById(pkt.path[pkt.seg]),b=nodeById(pkt.path[pkt.seg+1]);
    if(!a||!b){dead.push(i);continue;}
    const edge=edgeByNodes(a.id,b.id);
    if(!edge){dead.push(i);continue;}
    const pressure=pressureMap.get(edgeKey(edge.s,edge.t))||{count:0,bytes:0,attack:0};
    pkt.edgeLoad=pressure.count;
    const qm=packetMoveFactor(edge,pressure,pkt);
    const lossChance=clamp(qm.loss+Math.max(0,qm.load*0.02)+(pkt.attack?0.012:0),0,0.92);
    if(Math.random()<lossChance*dt*8){LAB_STATE.totalDrops++;dead.push(i);continue;}
    pkt.t+=dt*speed*qm.step;
    if(pkt.t>=1){
      const nextIndex=pkt.seg+1;
      const nextNode=nodeById(pkt.path[nextIndex]);
      if(nextNode&&firewallNode(nextNode)&&!firewallVerdict(nextNode,pkt)){dead.push(i);continue;}
      if(nextIndex>=pkt.path.length-1){
        LAB_STATE.delivered++;
        if(pkt.attack){
          const tgt=nodeById(pkt.target);
          if(tgt&&Math.random()<0.03){
            const now=performance.now();
            if(now-LAB_STATE.lastLogAt>1200){
              addLog(`🧨 ${tgt.label} is under ${pkt.kind} pressure`,"warn");
              LAB_STATE.lastLogAt=now;
            }
          }
        }
        dead.push(i);
        continue;
      }
      pkt.seg=nextIndex;
      pkt.t=0;
      pkt.delay+=(qm.metrics.lat+qm.jitterMs);
    }
  }
  for(let i=dead.length-1;i>=0;i--)pkts.splice(dead[i],1);
  if(pkts.length>260)pkts.splice(0,pkts.length-260);
  renderPkts();
}
requestAnimationFrame(loop);

function updateDevBtns(){document.querySelectorAll(".db").forEach(b=>b.classList.toggle("active",b.dataset.t===addMode));}
function updateConnBtn(){
  const b=document.getElementById("connbtn");
  const hint=document.getElementById("linkhint");
  const type=document.getElementById("linktype")?.value||selectedLinkType||"auto";
  const preset=edgePreset(type);
  b.classList.toggle("active",connMode);
  b.textContent=connMode?`✕ Cancel • ${preset.label}`:`🔗 Connect Nodes • ${preset.label}`;
  if(hint)hint.textContent=connMode?`Click a source node, then a target node. New links will use ${preset.label}.`:`Choose a preset for new links. Auto will infer a sensible link from the two endpoints.`;
}
function updateHints(){
  const ba=document.getElementById("b-add"),bc=document.getElementById("b-conn");
  const type=document.getElementById("linktype")?.value||selectedLinkType||"auto";
  const preset=edgePreset(type);
  if(addMode){ba.style.display="";ba.textContent=`📍 Click canvas — ${D[addMode]?.l}`;bc.style.display="none";}
  else if(connMode){bc.style.display="";bc.textContent=connStart?`Select target node • ${preset.label}`:`Select source node • ${preset.label}`;ba.style.display="none";}
  else{ba.style.display="none";bc.style.display="none";}
}
function addLog(msg,t){logs.unshift({msg,t,time:new Date().toLocaleTimeString()});if(logs.length>80)logs.pop();if(activeTab==="log")renderRight();}

document.querySelectorAll(".db").forEach(b=>b.addEventListener("click",()=>{addMode=addMode===b.dataset.t?null:b.dataset.t;connMode=false;connStart=null;updateDevBtns();updateConnBtn();updateHints();svg.className.baseVal="";if(addMode)svg.classList.add("m-add");}));
document.getElementById("connbtn").addEventListener("click",()=>{connMode=!connMode;connStart=null;addMode=null;updateDevBtns();updateConnBtn();updateHints();svg.className.baseVal="";if(connMode)svg.classList.add("m-conn");});
document.getElementById("linktype").addEventListener("change",e=>{selectedLinkType=e.target.value;updateConnBtn();updateHints();});
document.getElementById("delbtn").addEventListener("click",()=>{if(selN){nodes=nodes.filter(n=>n.id!==selN);edges=edges.filter(e=>e.s!==selN&&e.t!==selN);pkts=pkts.filter(p=>!p.path.includes(selN));addLog("🗑 Node deleted","warn");selN=null;}else if(selE){edges=edges.filter(e=>e.id!==selE);addLog("🗑 Link deleted","warn");selE=null;}render();renderRight();});
document.getElementById("clrpkt").addEventListener("click",()=>{pkts=[];addLog("🧹 Packets cleared","info");});
document.getElementById("clrall").addEventListener("click",()=>{nodes=[];edges=[];pkts=[];selN=null;selE=null;addLog("✕ Canvas cleared","warn");render();renderRight();});
document.getElementById("rbtn").addEventListener("click",()=>{running=!running;const b=document.getElementById("rbtn");b.className="run-btn "+(running?"run-run":"run-pause");b.textContent=running?"⏸ PAUSE":"▶ RUN";});
document.querySelectorAll(".spd-btn").forEach(b=>b.addEventListener("click",()=>{speed=parseFloat(b.dataset.s);document.querySelectorAll(".spd-btn").forEach(x=>x.classList.toggle("active",x.dataset.s===b.dataset.s));}));
document.querySelectorAll(".rt").forEach(b=>b.addEventListener("click",()=>{activeTab=b.dataset.r;document.querySelectorAll(".rt").forEach(x=>x.classList.toggle("active",x.dataset.r===activeTab));renderRight();}));

const scKeys=Object.keys(SCENARIOS);
const scTabEl=document.getElementById("sc-tabs");
scKeys.forEach(k=>{const b=document.createElement("button");b.className="sc-btn";b.dataset.k=k;b.textContent=SCENARIOS[k].name;b.addEventListener("click",()=>loadSc(k));scTabEl.appendChild(b);});
initSidebarWidths();
updateConnBtn();
updateHints();

// Drawer toggle buttons (mobile): toggle left/right sidebars as overlays
const tLeftBtn=document.getElementById('toggle-left');
const tRightBtn=document.getElementById('toggle-right');
if(tLeftBtn){tLeftBtn.addEventListener('click',()=>{const open=document.body.classList.toggle('drawer-left-open');tLeftBtn.setAttribute('aria-expanded',String(open));if(open)document.body.classList.remove('drawer-right-open');});}
if(tRightBtn){tRightBtn.addEventListener('click',()=>{const open=document.body.classList.toggle('drawer-right-open');tRightBtn.setAttribute('aria-expanded',String(open));if(open)document.body.classList.remove('drawer-left-open');});}

// close drawers when clicking canvas/background
svg.addEventListener('click',()=>{if(document.body.classList.contains('drawer-left-open')||document.body.classList.contains('drawer-right-open')){document.body.classList.remove('drawer-left-open');document.body.classList.remove('drawer-right-open');tLeftBtn?.setAttribute('aria-expanded','false');tRightBtn?.setAttribute('aria-expanded','false');}});

// Keyboard shortcuts: Space = toggle run, F = toggle left, H = toggle right, C = toggle connect tool
document.addEventListener('keydown',e=>{
  if(e.target && /input|textarea|select/i.test(e.target.tagName))return;
  if(e.code==='Space'){e.preventDefault();running=!running;const b=document.getElementById('rbtn');b.className='run-btn '+(running?'run-run':'run-pause');b.textContent=running?"⏸ PAUSE":"▶ RUN";}
  else if(e.key==='f' || e.key==='F'){e.preventDefault();tLeftBtn?.click();}
  else if(e.key==='h' || e.key==='H'){e.preventDefault();tRightBtn?.click();}
  else if(e.key==='c' || e.key==='C'){e.preventDefault();document.getElementById('connbtn')?.click();}
});

const leftResize=document.getElementById("l-resize");
const rightResize=document.getElementById("r-resize");
if(leftResize){
  const startLeftResize=e=>{e.preventDefault();beginResize("left",e);};
  leftResize.addEventListener("pointerdown",startLeftResize);
  leftResize.addEventListener("mousedown",startLeftResize);
  leftResize.addEventListener("keydown",e=>{
    const step=e.shiftKey?24:12;
    if(e.key==="ArrowLeft"||e.key==="ArrowRight"){
      e.preventDefault();
      const {leftMin,leftMax,rightMin}=sidebarBounds();
      const left=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--left-w"))||148;
      applySidebarWidths(clamp(left+(e.key==="ArrowRight"?step:-step),leftMin,leftMax),clamp(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--right-w"))||286,rightMin,sidebarBounds().rightMax));
    }
  });
}
if(rightResize){
  const startRightResize=e=>{e.preventDefault();beginResize("right",e);};
  rightResize.addEventListener("pointerdown",startRightResize);
  rightResize.addEventListener("mousedown",startRightResize);
  rightResize.addEventListener("keydown",e=>{
    const step=e.shiftKey?24:12;
    if(e.key==="ArrowLeft"||e.key==="ArrowRight"){
      e.preventDefault();
      const {rightMin,rightMax,leftMin}=sidebarBounds();
      const right=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--right-w"))||286;
      applySidebarWidths(clamp(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--left-w"))||148,leftMin,sidebarBounds().leftMax),clamp(right+(e.key==="ArrowLeft"?step:-step),rightMin,rightMax));
    }
  });
}
document.addEventListener("pointermove",moveResize);
document.addEventListener("mousemove",moveResize);
document.addEventListener("pointerup",endResize);
document.addEventListener("mouseup",endResize);
document.addEventListener("pointercancel",endResize);
window.addEventListener("resize",()=>{const b=sidebarBounds();applySidebarWidths(clamp(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--left-w"))||148,b.leftMin,b.leftMax),clamp(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--right-w"))||286,b.rightMin,b.rightMax));});

function genHdrVis(proto){
  const layers={
    ICMP:[{l:"IP Header",c:"#3b82f6",f:["Ver","IHL","TTL","Proto=1","Src IP","Dst IP"]},{l:"ICMP",c:"#ffd700",f:["Type(8=req,0=rep)","Code","Checksum","Identifier","Seq Number","Data..."]}],
    TCP:[{l:"IP Header",c:"#3b82f6",f:["Ver","IHL","TTL","Proto=6","Src IP","Dst IP"]},{l:"TCP Header",c:"#00ddff",f:["Src Port","Dst Port","Seq Num","ACK Num","Flags(SYN/ACK/FIN)","Window","Chk"]},{l:"Payload",c:"#3a6080",f:["Application Data..."]}],
    UDP:[{l:"IP Header",c:"#3b82f6",f:["Ver","IHL","TTL","Proto=17","Src IP","Dst IP"]},{l:"UDP Header",c:"#00ff88",f:["Src Port","Dst Port","Length","Checksum"]},{l:"Payload",c:"#3a6080",f:["Data"]}],
    HTTP:[{l:"Ethernet",c:"#8b5cf6",f:["Dst MAC","Src MAC","EtherType"]},{l:"IP",c:"#3b82f6",f:["Src IP","Dst IP","TTL"]},{l:"TCP",c:"#00ddff",f:["Src Port","Dst Port=80","Seq","ACK"]},{l:"HTTP",c:"#60a5fa",f:["GET / HTTP/1.1","Host: example.com","Accept: text/html"]}],
    HTTPS:[{l:"IP",c:"#3b82f6",f:["Src IP","Dst IP"]},{l:"TCP",c:"#00ddff",f:["Dst Port=443"]},{l:"TLS",c:"#f59e0b",f:["ContentType","Version TLS1.3","IV+AuthTag"]},{l:"HTTP (enc)",c:"#34d399",f:["[Encrypted payload]"]}],
    DNS:[{l:"IP",c:"#3b82f6",f:["Src IP","Dst IP 8.8.8.8","Proto=17"]},{l:"UDP",c:"#00ff88",f:["Dst Port=53"]},{l:"DNS",c:"#a855f7",f:["Tx ID","Flags","Question: A www.example.com","Answer: 93.184.216.34"]}],
    ARP:[{l:"Ethernet",c:"#8b5cf6",f:["Dst FF:FF:FF:FF:FF:FF","Src MAC","EtherType=0x0806"]},{l:"ARP",c:"#f472b6",f:["op=1(Request)","Sender MAC","Sender IP","Target IP"]}]
  };
  const lrs=layers[proto]||layers.TCP;
  return lrs.map(l=>`<div class="hdr-layer"><div class="hdr-name" style="--lc:${l.c}">${l.l}</div><div class="hdr-fields">${l.f.map(f=>`<div class="hdr-f" style="--lc:${l.c}">${f}</div>`).join("")}</div></div>`).join("");
}

function renderRight(){
  const rc=document.getElementById("rc");
  if(activeTab==="info")rc.innerHTML=renderInfo();
  else if(activeTab==="pkt")rc.innerHTML=renderPkt();
  else if(activeTab==="osi")rc.innerHTML=renderOsi();
  else if(activeTab==="tcp")rc.innerHTML=renderTCP();
  else if(activeTab==="tools")rc.innerHTML=renderTools();
  else if(activeTab==="vlan")rc.innerHTML=renderVLAN();
  else if(activeTab==="route")rc.innerHTML=renderRoute();
  else if(activeTab==="log")rc.innerHTML=renderLog();
  bindRight();
}

function renderInfo(){
  const sn=nodes.find(n=>n.id===selN);const se=edges.find(e=>e.id===selE);
  if(sn){
    const dev=D[sn.type]||D.pc;
    const prHTML=Object.entries(PR).map(([k,v])=>`<button class="pb${selProto===k?" active":""}" style="--pc:${v.c}" data-p="${k}">${k}</button>`).join("");
    return`<span class="field">NODE INSPECTOR</span>
      <div class="icard"><div class="iico">${dev.i}</div><div class="iname">${sn.label}</div>
      <div class="isub">${dev.l}</div>${sn.ip?`<div class="isub">${sn.ip}</div>`:""}</div>
      <span class="field">SEND PACKET</span>
      <div class="pbrow">${prHTML}</div>
      <button class="sbtn" id="spkt">▶ Send ${selProto}</button>
      <button class="sbtn2" id="bcast">⟳ Broadcast Burst</button>
      <div class="lbox"><div class="ltitle">HOW THIS WORKS</div>
      <div class="ltext">${DEVINFO[sn.type]||"Select a node to learn about it."}</div></div>`;
  }
  if(se){
    const sn2=nodes.find(n=>n.id===se.s),tn=nodes.find(n=>n.id===se.t);
    const lp=edgePreset(se.type||inferLinkType(sn2,tn,se.l));
    const opts=LINK_CHOICES.map(k=>`<option value="${k}" ${((se.type||"auto")===k)?"selected":""}>${edgePreset(k).label}${k==="auto"?" (smart)":""}</option>`).join("");
    return`<span class="field">LINK INSPECTOR</span>
      <div class="icard"><div class="iico">🔗</div><div class="iname">${se.label||se.l||lp.label}</div>
      <div class="isub">${sn2?.label||se.s} ↔ ${tn?.label||se.t}</div>
      <div class="isub" style="color:${lp.c};margin-top:3px">${lp.label} • ${lp.medium}</div></div>
      <div class="tool-section">
        <div class="ltitle">LINK SETTINGS</div>
        <div class="tool-row"><span class="tool-lbl">Type</span><select class="tool-input" id="lk-type">${opts}</select></div>
        <div class="tool-row"><span class="tool-lbl">Label</span><input class="tool-input" id="lk-label" value="${se.label||se.l||lp.label}"></div>
        <div class="tool-row"><span class="tool-lbl">BW</span><input class="tool-input" id="lk-bw" type="number" min="1" value="${se.bw||lp.bw}"><span class="tool-lbl" style="min-width:auto">Mbps</span></div>
        <div class="tool-row"><span class="tool-lbl">Latency</span><input class="tool-input" id="lk-lat" type="number" min="0" value="${se.lat||lp.lat}"><span class="tool-lbl" style="min-width:auto">ms</span></div>
        <div class="tool-row"><span class="tool-lbl">Duplex</span><select class="tool-input" id="lk-duplex"><option value="full" ${((se.duplex||lp.duplex)==="full")?"selected":""}>Full</option><option value="half" ${((se.duplex||lp.duplex)==="half")?"selected":""}>Half</option></select></div>
        <button class="sbtn" id="lk-apply">Apply Link Settings</button>
        <button class="sbtn2" id="lk-del">Unlink</button>
      </div>
      <div class="lbox"><div class="ltitle">ABOUT LINKS</div>
      <div class="ltext">Links are now editable network objects with real presets: Ethernet, Fiber, Wi‑Fi, WAN, VPN, DNS service paths, and trunks. Change the preset to update bandwidth, latency, line style, and label together.</div></div>`;
  }
  const sc=SCENARIOS[activeSc];
  return`<span class="field">SCENARIO</span>
    <div class="icard"><div class="iname">${sc?.name||"Custom"}</div><div class="ltext" style="margin-top:4px">${sc?.desc||""}</div></div>
    <div class="lbox"><div class="ltitle">GETTING STARTED</div>
    <div class="ltext">🖱 Drag nodes to rearrange<br>📍 Left panel: add devices → click canvas<br>🔗 Connect tool: wire nodes<br>📦 Auto packets flow when running<br>▶ Click node → Send any protocol<br>🔍 OSI tab: full 7-layer reference<br>🔧 TCP tab: 3-way handshake walkthrough<br>🛠 Tools tab: ping, traceroute, subnet calc</div></div>`;
}

function renderPkt(){
  return`<span class="field">PACKET DISSECTOR</span>
    <div class="pbrow">${Object.entries(PR).map(([k,v])=>`<button class="pb${selProto===k?" active":""}" style="--pc:${v.c}" data-p="${k}">${k}</button>`).join("")}</div>
    <div class="hdr-vis"><div class="hdr-title">${selProto} HEADER STRUCTURE</div>${genHdrVis(selProto)}</div>
    <div class="lbox"><div class="ltitle">${selProto} EXPLAINED</div>
    <div class="ltext">${PR[selProto]?.info||""}</div></div>
    <span class="field" style="margin-top:8px">LIVE COUNTS</span>
    ${Object.entries(PR).map(([k,v])=>{const cnt=pkts.filter(p=>p.proto===k).length;return`<div class="prow"><div class="pdot" style="background:${v.c}"></div><div><div class="pkey" style="color:${v.c}">${k}</div><div class="plbl">${v.l}</div></div><div class="pcnt" style="color:${v.c}">${cnt||""}</div></div>`;}).join("")}`;
}

function renderOsi(){
  return`<span class="field">OSI REFERENCE MODEL</span>`+
  OSI_DATA.map(l=>`<div class="osi-r" style="--lc:${l.c}" onclick="this.querySelector('.osi-detail').classList.toggle('open')">
    <div class="osi-h"><span class="osi-n">L${l.n} — ${l.name}</span><span style="font-size:8px;color:${l.c}">▾</span></div>
    <div class="osi-d">${l.d}</div><div class="osi-p">${l.proto}</div>
    <div class="osi-detail"><div class="ltext">${l.detail}</div></div>
  </div>`).join("")+
  `<div class="lbox"><div class="ltitle">ENCAPSULATION</div><div class="ltext">Sender: App data → L4 adds TCP/UDP header → L3 adds IP header → L2 adds Eth frame → L1 puts bits on wire. Receiver strips headers bottom-up (decapsulation).</div></div>`;
}

function renderTCP(){
  return`<span class="field">TCP 3-WAY HANDSHAKE</span>
    ${TCP_STEPS.map((s,i)=>`<div class="tcp-step" onclick="this.querySelector('.tcp-detail').classList.toggle('open')">
      <div class="tcp-step-hdr"><span style="font-size:12px">${s.from}</span><span class="tcp-flag">${s.flags}</span><span style="font-size:7px;color:#1a3a5a;margin-left:auto">[${i+1}/${TCP_STEPS.length}]</span></div>
      <div class="tcp-desc">${s.desc}</div>
      <div class="tcp-detail">${s.detail}</div>
    </div>`).join("")}
    <div class="lbox"><div class="ltitle">TCP STATE MACHINE</div>
    <div class="ltext">CLOSED → LISTEN → SYN_RCVD → ESTABLISHED → FIN_WAIT_1 → FIN_WAIT_2 → TIME_WAIT → CLOSED (active closer). TIME_WAIT lasts 2×MSL (~60s) to prevent old duplicate segments from corrupting new connections.</div></div>`;
}

function renderTools(){
  const profileOpts=Object.entries(SIM_PROFILES).map(([k,v])=>`<option value="${k}" ${LAB_STATE.profile===k?"selected":""}>${v.label}</option>`).join("");
  return`<span class="field">NETWORK TOOLS</span>
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

function renderVLAN(){
  const vlans=VLANS[activeSc]||VLANS.default;
  return`<span class="field">VLAN CONFIGURATION</span>
    ${vlans.map(v=>`<div class="vlan-row" style="--vc:${v.c}"><div class="vlan-id">VLAN ${v.id}</div><div><div class="vlan-name">${v.name}</div><div class="vlan-ports">${v.ports}</div></div></div>`).join("")}
    <div class="lbox"><div class="ltitle">HOW VLANs WORK</div>
    <div class="ltext">VLANs (802.1Q) logically segment a switch at Layer 2. A port is either Access (carries one VLAN, strips tag) or Trunk (carries multiple VLANs, preserves 802.1Q tags). The 4-byte tag: 2B TPID=0x8100 + 2B TCI (3b PCP + 1b DEI + 12b VLAN ID → 4094 VLANs). Inter-VLAN routing requires an L3 switch SVI or router-on-a-stick.</div></div>`;
}

function renderRoute(){
  const tbl=ROUTING_TABLES[activeSc];
  let rows=`<span class="field">ROUTING TABLE</span>`;
  if(tbl){rows+=`<div style="overflow-x:auto"><table class="rt-table"><thead><tr><th>DESTINATION</th><th>NEXT HOP</th><th>PROTO</th><th>AD</th></tr></thead><tbody>`;tbl.forEach(r=>{rows+=`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`;});rows+=`</tbody></table></div>`;}
  rows+=`<div class="lbox"><div class="ltitle">ROUTING CONCEPTS</div><div class="ltext">Administrative Distance (AD): Connected=0, Static=1, OSPF=110, RIP=120, eBGP=20, iBGP=200. Longest prefix match wins — /32 beats /24 beats /0. ECMP load-balances across equal-cost paths. Recursive lookup resolves next-hop IPs through the FIB.</div></div>`;
  return rows;
}

function renderLog(){
  const tc={ok:"#00ff88",warn:"#ffc700",info:"#2a5070",packet:"#60a5fa"};
  return`<div class="lhdr"><span class="field" style="margin:0">EVENT LOG</span><button class="lclr" id="lclr">CLEAR</button></div>
    <div>${logs.map(l=>`<div class="log-i" style="border-color:${tc[l.t]||"#0e2040"}"><span class="lt">${l.time} </span><span style="color:${tc[l.t]||"#2a5070"}">${l.msg}</span></div>`).join("")}</div>`;
}

function bindRight(){
  document.querySelectorAll(".pb").forEach(b=>b.addEventListener("click",()=>{selProto=b.dataset.p;renderRight();}));
  const labProfile=document.getElementById("lab-profile");
  if(labProfile)labProfile.addEventListener("change",()=>{LAB_STATE.profile=labProfile.value;refreshLabState();});
  const labApply=document.getElementById("lab-apply");
  if(labApply)labApply.addEventListener("click",()=>{applyProfile(document.getElementById("lab-profile")?.value||LAB_STATE.profile);refreshLabState();});
  const labReset=document.getElementById("lab-reset");
  if(labReset)labReset.addEventListener("click",()=>{stopAllLabFlows();applyProfile("normal",false);refreshLabState();});
  const labStop=document.getElementById("lab-stop");
  if(labStop)labStop.addEventListener("click",()=>{stopAllLabFlows();refreshLabState();});
  const targetNode=selN?nodeById(selN):null;
  const labVoip=document.getElementById("lab-voip");
  if(labVoip)labVoip.addEventListener("click",()=>{const flow=startLabFlow("voip",targetNode?{dst:targetNode}:{});if(flow)refreshLabState();});
  const labStream=document.getElementById("lab-stream");
  if(labStream)labStream.addEventListener("click",()=>{const flow=startLabFlow("stream",targetNode?{dst:targetNode}:{});if(flow)refreshLabState();});
  const labWeb=document.getElementById("lab-web");
  if(labWeb)labWeb.addEventListener("click",()=>{const flow=startLabFlow("web",targetNode?{dst:targetNode}:{});if(flow)refreshLabState();});
  const labDos=document.getElementById("lab-dos");
  if(labDos)labDos.addEventListener("click",()=>{const flow=startLabFlow("dos",targetNode?{dst:targetNode}:{});if(flow)refreshLabState();});
  const labDdos=document.getElementById("lab-ddos");
  if(labDdos)labDdos.addEventListener("click",()=>{const flow=startLabFlow("ddos",{distributed:true,dst:targetNode||pickScenarioEndPoints("ddos").dst});if(flow)refreshLabState();});
  const labSyn=document.getElementById("lab-syn");
  if(labSyn)labSyn.addEventListener("click",()=>{const flow=startLabFlow("syn",targetNode?{dst:targetNode}:{});if(flow)refreshLabState();});
  const labDns=document.getElementById("lab-dnsamp");
  if(labDns)labDns.addEventListener("click",()=>{const flow=startLabFlow("dnsamp",{distributed:true,dst:targetNode||pickScenarioEndPoints("dnsamp").dst});if(flow)refreshLabState();});
  const lkType=document.getElementById("lk-type");
  if(lkType)lkType.addEventListener("change",()=>{selectedLinkType=lkType.value;});
  const lkApply=document.getElementById("lk-apply");
  if(lkApply)lkApply.addEventListener("click",()=>{
    const e=edges.find(x=>x.id===selE);if(!e)return;
    const t=document.getElementById("lk-type")?.value||e.type||"ethernet";
    const p=edgePreset(t==="auto"?inferLinkType(nodes.find(n=>n.id===e.s),nodes.find(n=>n.id===e.t),document.getElementById("lk-label")?.value||e.label):t);
    e.type=t==="auto"?inferLinkType(nodes.find(n=>n.id===e.s),nodes.find(n=>n.id===e.t),document.getElementById("lk-label")?.value||e.label):t;
    e.label=document.getElementById("lk-label")?.value?.trim()||p.label;
    e.l=e.label;
    e.bw=Math.max(1,parseInt(document.getElementById("lk-bw")?.value||p.bw,10)||p.bw);
    e.lat=Math.max(0,parseInt(document.getElementById("lk-lat")?.value||p.lat,10)||p.lat);
    e.duplex=document.getElementById("lk-duplex")?.value||p.duplex;
    const pp=edgePreset(e.type);
    e.color=pp.c;e.dash=pp.dash;e.stroke=pp.stroke;
    selectedLinkType=e.type;
    const linkPick=document.getElementById("linktype");
    if(linkPick)linkPick.value=selectedLinkType;
    updateConnBtn();
    updateHints();
    addLog(`✎ Updated link: ${e.label} (${pp.label})`,"info");
    render();renderRight();
  });
  const lkDel=document.getElementById("lk-del");
  if(lkDel)lkDel.addEventListener("click",()=>{if(!selE)return;edges=edges.filter(e=>e.id!==selE);addLog("🔗 Link removed","warn");selE=null;render();renderRight();});
  const spkt=document.getElementById("spkt");
  if(spkt)spkt.addEventListener("click",()=>{const sn=nodes.find(n=>n.id===selN);if(!sn)return;const others=nodes.filter(n=>n.id!==selN);if(!others.length)return;const t=others[Math.floor(Math.random()*others.length)];spawn(selN,t.id,selProto);addLog(`📦 ${selProto}: ${sn.label}→${t.label}`,"packet");});
  const bc=document.getElementById("bcast");
  if(bc)bc.addEventListener("click",()=>{const sn=nodes.find(n=>n.id===selN);if(!sn)return;nodes.filter(n=>n.id!==selN).forEach(t=>{const ps=Object.keys(PR);spawn(selN,t.id,ps[Math.floor(Math.random()*ps.length)]);});addLog(`📡 Broadcast from ${sn.label}`,"packet");});
  const pingBtn=document.getElementById("ping-btn");
  if(pingBtn)pingBtn.addEventListener("click",()=>{const ip=document.getElementById("ping-tgt").value;const ms=()=>Math.round(Math.random()*15+1);document.getElementById("ping-out").className="tool-result";document.getElementById("ping-out").innerHTML=`PING ${ip}:<br>64 bytes icmp_seq=1 ttl=64 time=${ms()} ms<br>64 bytes icmp_seq=2 ttl=64 time=${ms()} ms<br>64 bytes icmp_seq=3 ttl=64 time=${ms()} ms<br>4 packets: 0% loss`;nodes.forEach(n=>{if(n.type!=="cloud")spawn(n.id,nodes[0]?.id||n.id,"ICMP");});});
  const trBtn=document.getElementById("tr-btn");
  if(trBtn)trBtn.addEventListener("click",()=>{const ip=document.getElementById("tr-tgt").value;const hops=Math.floor(Math.random()*8)+5;let html=`<div style="font-size:8px;color:#00ddff;margin-bottom:4px">traceroute to ${ip}:</div>`;const pf=["10.0.0","192.168.0","172.16.0","10.1.0"];for(let i=1;i<=hops;i++){const ms=Math.round(Math.random()*30+i*2);html+=`<div class="hop-row"><span class="hop-n">${i}</span><span class="hop-ip">${pf[i%pf.length]}.${Math.floor(Math.random()*254)+1}</span><span class="hop-ms">${ms} ms</span></div>`;}html+=`<div class="hop-row"><span class="hop-n">${hops+1}</span><span class="hop-ip">${ip}</span><span class="hop-ms">${Math.round(Math.random()*8+hops*3)} ms</span></div>`;document.getElementById("tr-out").className="tool-result";document.getElementById("tr-out").innerHTML=html;});
  const snBtn=document.getElementById("sn-btn");
  if(snBtn)snBtn.addEventListener("click",()=>{const ipStr=document.getElementById("sn-ip").value;const cidr=parseInt(document.getElementById("sn-cidr").value);const out=document.getElementById("sn-out");try{const parts=ipStr.split(".").map(Number);if(parts.length!==4||parts.some(p=>isNaN(p)||p<0||p>255)||isNaN(cidr)||cidr<0||cidr>32)throw new Error();const hostBits=32-cidr;const hosts=cidr<31?Math.pow(2,hostBits)-2:cidr===31?2:1;const mask=cidr===0?0:(0xFFFFFFFF<<(32-cidr))>>>0;const toOct=n=>`${(n>>>24)&255}.${(n>>>16)&255}.${(n>>>8)&255}.${n&255}`;const network=(((parts[0]<<24)|(parts[1]<<16)|(parts[2]<<8)|parts[3])&mask)>>>0;const broadcast=(network|(~mask>>>0))>>>0;const first=cidr<31?network+1:network;const last=cidr<31?broadcast-1:broadcast;out.className="tool-result";out.innerHTML=`<div class="subnet-row"><span class="sub-k">Network</span><span class="sub-v">${toOct(network)}/${cidr}</span></div><div class="subnet-row"><span class="sub-k">Subnet mask</span><span class="sub-v">${toOct(mask)}</span></div><div class="subnet-row"><span class="sub-k">Wildcard</span><span class="sub-v">${toOct(~mask>>>0)}</span></div><div class="subnet-row"><span class="sub-k">Broadcast</span><span class="sub-v">${toOct(broadcast)}</span></div><div class="subnet-row"><span class="sub-k">First host</span><span class="sub-v">${toOct(first)}</span></div><div class="subnet-row"><span class="sub-k">Last host</span><span class="sub-v">${toOct(last)}</span></div><div class="subnet-row"><span class="sub-k">Usable hosts</span><span class="sub-v">${hosts.toLocaleString()}</span></div>`;}catch{out.className="tool-err";out.textContent="Invalid input — use format: 192.168.1.0 / 24";}});
  const nsBtn=document.getElementById("ns-btn");
  if(nsBtn)nsBtn.addEventListener("click",()=>{const q=document.getElementById("ns-q").value;const ip=`${Math.floor(Math.random()*220)+10}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*254)+1}`;document.getElementById("ns-out").className="tool-result";document.getElementById("ns-out").innerHTML=`Server: 8.8.8.8<br>Query: ${q} A<br>Answer: ${ip} TTL=${Math.floor(Math.random()*3000)+300}s<br>AAAA: 2607:f8b0::${Math.floor(Math.random()*9999).toString(16)}`;nodes.filter(n=>n.type==="dns").forEach(dn=>nodes.forEach(n=>{if(n.id!==dn.id)spawn(n.id,dn.id,"DNS");}));});
  const lclr=document.getElementById("lclr");if(lclr)lclr.addEventListener("click",()=>{logs=[];renderRight();});
}

function refreshLabState(){
  const out=document.getElementById("lab-out");
  if(out){
    const profile=SIM_PROFILES[LAB_STATE.profile]||SIM_PROFILES.normal;
    out.className="tool-result";
    out.innerHTML=`${profile.desc}<br>${LAB_STATE.flows.length} live flow(s), ${LAB_STATE.blocked} firewall blocks, ${LAB_STATE.totalDrops} drops.`;
  }
  renderHUD();
}

loadSc("home");
