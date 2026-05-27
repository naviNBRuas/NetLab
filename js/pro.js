/* NetLab Pro v1.0.0 — Advanced Analysis Module */

const PROTO_COLORS={ICMP:"#ffd700",TCP:"#00ddff",UDP:"#00ff88",HTTP:"#60a5fa",HTTPS:"#34d399",DNS:"#a855f7",DHCP:"#fb923c",ARP:"#f472b6",BGP:"#ef4444",OSPF:"#f97316",TLS:"#06b6d4",SSH:"#a78bfa",SMTP:"#e879f9",SNMP:"#84cc16",NTP:"#38bdf8"};
const IPS=["10.0.0.1","10.0.0.10","10.0.0.11","192.168.1.1","192.168.1.50","172.16.0.1","8.8.8.8","1.1.1.1","203.0.113.1","10.1.0.5","10.2.0.20","172.31.0.1"];
const MACS=["00:1A:2B:3C:4D:5E","AA:BB:CC:DD:EE:FF","11:22:33:44:55:66","DE:AD:BE:EF:00:01","CA:FE:BA:BE:00:02","FA:CE:B0:0C:00:03"];

const QUIZ=[
  {q:"A host sends an ARP request. What is the Ethernet destination MAC address?",opts:["FF:FF:FF:FF:FF:FF","The gateway's MAC","00:00:00:00:00:00","The host's own MAC"],ans:0,explain:"ARP requests are broadcast at Layer 2. The destination MAC is FF:FF:FF:FF:FF:FF so every device on the segment receives it. Only the IP owner replies with its MAC unicast."},
  {q:"What is the TTL field in an IP packet used for?",opts:["Time the packet was sent","Prevent routing loops by limiting hop count","Time until ARP cache expires","TCP connection timeout"],ans:1,explain:"TTL (Time to Live) is decremented by each router. When it reaches 0, the packet is dropped and an ICMP Time Exceeded is sent back. This prevents infinite routing loops. Traceroute exploits this by sending packets with TTL=1,2,3... to map each hop."},
  {q:"Which protocol does a host use first to communicate with its default gateway?",opts:["DNS","OSPF","ARP","DHCP"],ans:2,explain:"To send frames to the gateway, the host must know its MAC address. It sends an ARP Request ('Who has 192.168.1.1?') and the gateway replies with its MAC. The result is cached in the ARP table for a few minutes."},
  {q:"What does a TCP SYN-ACK segment indicate?",opts:["Connection teardown initiated","Server acknowledging client SYN and sending its own SYN","Data transfer complete","Port unreachable"],ans:1,explain:"SYN-ACK is step 2 of the TCP 3-way handshake. The server (1) acknowledges the client's SYN by setting ACK=client_ISN+1, and (2) sends its own SYN to establish the reverse direction. Both SYN and ACK flags are set simultaneously."},
  {q:"DNS uses which transport protocol by default for standard queries?",opts:["TCP port 53","UDP port 53","UDP port 67","TCP port 80"],ans:1,explain:"Standard DNS queries use UDP port 53 because they're small and speed matters. TCP port 53 is used for zone transfers (AXFR), responses exceeding 512 bytes, and DNS over TLS (DoT). DNS over HTTPS (DoH) uses TCP 443."},
  {q:"A switch receives a frame with an unknown destination MAC. What does it do?",opts:["Drop the frame","Send it only to the default gateway","Flood it to all ports except the source port","Send an ARP request"],ans:2,explain:"This is called 'unicast flooding'. The switch's CAM table has no entry for the destination MAC, so it forwards the frame to all ports except where it arrived. The correct destination will receive it and reply, allowing the switch to learn its MAC-to-port mapping."},
  {q:"What is the purpose of OSPF's Area 0?",opts:["It's the management VLAN","The backbone area — all other areas must connect to it","It stores only the default route","It's the OSPF authentication area"],ans:1,explain:"Area 0 is the OSPF backbone. All non-zero areas must connect to Area 0 directly or via a virtual link. Area Border Routers (ABRs) sit between areas and summarize routes. This hierarchical design limits LSA flooding and reduces LSDB size in large networks."},
  {q:"Which TCP flag immediately resets a connection without a graceful teardown?",opts:["SYN+ACK","FIN+ACK","RST","PSH+URG"],ans:2,explain:"A RST (Reset) segment immediately terminates a TCP connection without a 4-way FIN handshake. RSTs are sent when a host receives traffic for a port with no listening socket, or when a firewall forcibly kills a session. Port scanners interpret RST replies as 'port closed'."},
  {q:"What is the maximum number of usable VLANs in 802.1Q?",opts:["256","1024","4094","65535"],ans:2,explain:"802.1Q uses a 12-bit VLAN ID field: 2^12 = 4096 values. VLANs 0 and 4095 are reserved, leaving 4094 usable VLANs (1–4094). VLAN 1 is the native/default VLAN. Q-in-Q (802.1ad) stacks two tags for up to ~16 million VLAN combinations."},
  {q:"What does NAT overload (PAT) use to differentiate multiple internal connections sharing one public IP?",opts:["Different public IP addresses","Source port numbers","VLAN tags","TTL values"],ans:1,explain:"PAT maps many internal hosts to one public IP using different source port numbers. The NAT table stores {internal IP:port ↔ public IP:ephemeral_port}. When a reply arrives, the router translates the destination port back to the correct internal host — enabling hundreds of devices to share one public IP."}
];

const ATTACK_DATA=[
  {id:"arp",name:"ARP Spoofing (Man-in-the-Middle)",layer:"L2",color:"#ff4455",desc:"Attacker sends gratuitous ARP replies poisoning the victim's ARP cache, mapping the gateway IP to the attacker's MAC. All victim traffic routes through the attacker. Defense: Dynamic ARP Inspection (DAI) on switches validates ARP against the DHCP snooping binding table.",steps:{atk:[{t:"atk",m:"🔴 Attacker sends gratuitous ARP: 'I am 10.0.0.1 (gateway), MAC=AA:BB:CC:DD:EE:FF'"},{t:"warn",m:"⚠️ Victim ARP cache: 10.0.0.1 → AA:BB:CC:DD:EE:FF (POISONED)"},{t:"atk",m:"🔴 All victim traffic now routes through attacker machine"},{t:"atk",m:"🔴 Attacker forwards to real gateway — victim is unaware (MitM)"}],def:[{t:"ok",m:"✅ Switch DAI enabled: validates ARP against DHCP snooping table"},{t:"ok",m:"✅ Attacker ARP rejected — MAC mismatch vs DHCP lease"},{t:"ok",m:"✅ Port rate-limited: >100 ARP/s → port shutdown triggered"},{t:"info",m:"ℹ️ Mitigation: DAI, static ARP entries, port security, ARP monitoring"}]}},
  {id:"syn",name:"SYN Flood (DoS)",layer:"L4",color:"#ff4455",desc:"Attacker sends thousands of TCP SYN packets with spoofed source IPs. Server allocates a TCB for each and waits for a final ACK that never comes. SYN queue exhausted → legitimate connections refused. Defense: SYN cookies eliminate the server-side queue requirement.",steps:{atk:[{t:"atk",m:"🔴 Attacker sends 50,000 SYN/s with random spoofed source IPs"},{t:"warn",m:"⚠️ Server SYN queue: 8192/8192 entries FULL"},{t:"atk",m:"🔴 Legitimate client SYN dropped — ECONNREFUSED / timeout"},{t:"warn",m:"⚠️ Server CPU at 98% processing half-open connections"}],def:[{t:"ok",m:"✅ SYN Cookies enabled: ISN encodes state — no queue needed"},{t:"ok",m:"✅ ACL rate-limit: >1000 SYN/s per source IP → drop"},{t:"ok",m:"✅ Upstream DDoS scrubbing center absorbs volumetric flood"},{t:"info",m:"ℹ️ Mitigation: SYN cookies, rate limiting, anycast scrubbing, BCP38"}]}},
  {id:"vlan",name:"VLAN Hopping (Double Tagging)",layer:"L2",color:"#ffc700",desc:"Attacker on the native VLAN sends frames with double 802.1Q tags: outer=native (stripped by first switch), inner=target VLAN. Frame arrives in target VLAN without routing through a firewall. One-way attack — replies cannot traverse back the same way.",steps:{atk:[{t:"atk",m:"🔴 Attacker crafts double-tagged frame: [VLAN1][VLAN10] payload"},{t:"warn",m:"⚠️ SW1 strips outer VLAN1 tag (native) and forwards on trunk"},{t:"warn",m:"⚠️ SW2 sees inner VLAN10 tag — delivers to VLAN10 hosts"},{t:"info",m:"ℹ️ Target VLAN10 host receives frame — firewall and ACLs bypassed"}],def:[{t:"ok",m:"✅ Native VLAN changed to unused VLAN 999 on all trunks"},{t:"ok",m:"✅ All access ports explicitly: switchport mode access"},{t:"ok",m:"✅ Native VLAN pruned from all trunk links"},{t:"info",m:"ℹ️ Mitigation: Change native VLAN, explicit port modes, disable DTP"}]}},
  {id:"dns",name:"DNS Amplification (DDoS)",layer:"L7",color:"#ff4455",desc:"Attacker spoofs victim's IP as DNS source, sends small queries (28 bytes) to open resolvers. Resolvers send large ANY responses (1400+ bytes) to victim — amplification factor up to 50x. Victim's bandwidth saturated without the attacker generating large traffic.",steps:{atk:[{t:"atk",m:"🔴 Attacker sends DNS ANY query (28B) spoofing victim 10.0.0.99"},{t:"warn",m:"⚠️ Open resolver sends 1,400B response to victim"},{t:"atk",m:"🔴 10,000 resolvers × 1,400B = 14 Gbps flood to victim"},{t:"warn",m:"⚠️ Victim uplink saturated — all legitimate traffic blocked"}],def:[{t:"ok",m:"✅ BCP38 ingress filtering: ISPs drop spoofed-source packets"},{t:"ok",m:"✅ Response Rate Limiting (RRL) on authoritative servers"},{t:"ok",m:"✅ ANY queries disabled on recursive resolvers"},{t:"info",m:"ℹ️ Mitigation: BCP38, RRL, disable open recursion, DNSSEC"}]}}
];

const PROTO_WALKTHROUGHS=[
  {id:"dhcp",name:"DHCP — DORA Process",color:"#fb923c",steps:[
    {title:"DISCOVER",dir:"→ Broadcast",desc:"Client has no IP. Broadcasts on 255.255.255.255 UDP port 67. Source IP=0.0.0.0. DHCP option 53=1 (Discover). Contains client MAC and parameter request list (subnet mask, gateway, DNS, lease time).",pkt:"UDP 0.0.0.0:68 → 255.255.255.255:67 | DHCP Discover | xid=0x1A2B3C4D | opts: param_req[1,3,6,51]"},
    {title:"OFFER",dir:"← Server",desc:"DHCP server responds with an IP offer. Sends: offered IP, server IP, subnet mask, default gateway, DNS servers, lease duration. Server temporarily reserves the IP. May unicast or broadcast depending on BROADCAST flag.",pkt:"UDP 192.168.1.1:67 → 255.255.255.255:68 | DHCP Offer | your_ip=192.168.1.50 lease=86400s gw=192.168.1.1 dns=8.8.8.8"},
    {title:"REQUEST",dir:"→ Broadcast",desc:"Client broadcasts a Request (still has no IP) to formally accept the offer. Broadcast allows other DHCP servers in a redundant setup to see the client chose a specific server. Option 54 = server identifier.",pkt:"UDP 0.0.0.0:68 → 255.255.255.255:67 | DHCP Request | requested_ip=192.168.1.50 server_id=192.168.1.1"},
    {title:"ACK",dir:"← Server",desc:"Server confirms the lease. Client configures its IP stack: IP address, subnet mask, default gateway, DNS. Sets a lease timer — will attempt renewal at T1 (50% of lease) and T2 (87.5%) before expiry.",pkt:"UDP 192.168.1.1:67 → 192.168.1.50:68 | DHCP ACK | ip=192.168.1.50 lease=86400s router=192.168.1.1 dns=8.8.8.8"}
  ]},
  {id:"dns",name:"DNS — Recursive Resolution",color:"#a855f7",steps:[
    {title:"Local Cache Check",dir:"Client",desc:"OS checks its local DNS resolver cache (from previous lookups). If an A record for 'www.example.com' exists and TTL hasn't expired, returns immediately with no network query needed.",pkt:"[local cache MISS] → forwarding to recursive resolver 8.8.8.8:53"},
    {title:"Recursive Resolver Query",dir:"→ 8.8.8.8",desc:"Query sent to configured DNS server (from DHCP). Resolver checks its own cache. If not cached, begins iterative resolution on behalf of the client. Client waits for the full answer.",pkt:"UDP 192.168.1.50:43210 → 8.8.8.8:53 | ID=0xAB12 RD=1 QTYPE=A QNAME=www.example.com"},
    {title:"Root Server Query",dir:"→ Root (.)",desc:"Resolver queries a root server (13 anycast clusters worldwide). Root doesn't know the answer — refers to .com TLD servers. Returns NS records for .com with their IP glue records.",pkt:"UDP 8.8.8.8 → 198.41.0.4:53 | QTYPE=NS . | Response: NS a.gtld-servers.net 192.5.6.30"},
    {title:"TLD Query",dir:"→ .com TLD",desc:"Resolver queries a .com TLD server. TLD knows which nameservers are authoritative for 'example.com'. Returns NS records: ns1.example.com, ns2.example.com and glue IPs.",pkt:"UDP 8.8.8.8 → 192.5.6.30:53 | QTYPE=NS example.com | NS: ns1.example.com 205.251.196.1"},
    {title:"Authoritative Answer",dir:"→ Authoritative NS",desc:"Authoritative nameserver for example.com returns the A record. TTL tells the resolver how long to cache. DNSSEC adds RRSIG signatures. Answer returned to the original client.",pkt:"UDP 8.8.8.8 → 205.251.196.1:53 | A www.example.com → 93.184.216.34 TTL=3600 | → client"}
  ]},
  {id:"tls",name:"TLS 1.3 — Handshake",color:"#06b6d4",steps:[
    {title:"ClientHello",dir:"→ Server",desc:"Client sends: supported TLS versions, cipher suites (e.g. TLS_AES_256_GCM_SHA384), client random (32 bytes), ECDHE key share (X25519 public key), SNI extension, and ALPN (h2 for HTTP/2).",pkt:"ClientHello: ver=TLS1.3 ciphers=[AES256_GCM_SHA384,CHACHA20_POLY1305] key_share=X25519 SNI=example.com ALPN=h2"},
    {title:"ServerHello + Certificate",dir:"← Server",desc:"Server selects cipher suite and TLS version. Sends its own ECDHE key share for key agreement. Sends X.509 certificate chain (leaf + intermediate + root CA). Certificate contains public key and domain SAN fields.",pkt:"ServerHello: cipher=AES256_GCM_SHA384 | Certificate: *.example.com issued_by=DigiCert valid=2024-2025"},
    {title:"Key Derivation",dir:"Both",desc:"Both sides compute the ECDHE shared secret: secret = ClientPublic × ServerPrivate (elliptic curve). From this, HKDF derives: handshake_secret, client_traffic_key, server_traffic_key, application_traffic_secret.",pkt:"[ECDHE shared secret — never transmitted] → HKDF-Extract → HKDF-Expand → AES-256 session keys"},
    {title:"Finished",dir:"← Server",desc:"Server sends CertificateVerify (ECDSA signature over the handshake transcript proving key ownership) and Finished (HMAC of full handshake). Client verifies signature against the certificate. 1-RTT complete.",pkt:"CertificateVerify(ECDSA_SHA256) + Finished(HMAC) | [1-RTT complete] → encrypted channel OPEN"},
    {title:"Application Data",dir:"↔ Both",desc:"TLS record layer encrypts HTTP/2 frames with AES-256-GCM. Each record: content_type(1B) + version(2B) + length(2B) + IV + ciphertext + 16B auth_tag. Auth tag detects any tampering. ECDHE keys deleted after handshake (PFS).",pkt:"TLSv1.3 ApplicationData (encrypted) | HTTP/2 HEADERS frame inside | AEAD auth_tag=16B"}
  ]},
  {id:"ospf",name:"OSPF — Neighbor Formation",color:"#f97316",steps:[
    {title:"Hello Packets",dir:"↔ Multicast",desc:"Routers send Hello packets every 10s to 224.0.0.5 (AllSPFRouters multicast). Hello contains: Router ID, Area ID, Hello/Dead intervals, Auth, Priority, DR/BDR IPs, Neighbor list. Must agree on Hello/Dead intervals and Area ID.",pkt:"OSPF Hello: routerID=1.1.1.1 area=0.0.0.0 hello_int=10 dead_int=40 priority=1 neighbors=[]"},
    {title:"2-Way State",dir:"← Neighbor",desc:"Router sees its own Router ID in the neighbor's Hello neighbor-list → 2-Way state. On broadcast networks, DR (Designated Router) and BDR are elected based on priority (highest wins), then Router ID as tiebreaker.",pkt:"OSPF Hello: routerID=2.2.2.2 area=0.0.0.0 neighbors=[1.1.1.1] → 2-Way established | DR election"},
    {title:"DBD Exchange",dir:"↔ Master/Slave",desc:"Database Description (DBD) packets exchange LSA header summaries. Master (higher Router ID) sends first, slave echoes with same sequence number. Both discover which LSAs the peer has that they're missing.",pkt:"OSPF DBD: seq=1001 I=1 M=1 MS=1 | LSA_headers=[{type=1 id=1.1.1.1 age=12 seq=0x80000001}...]"},
    {title:"LSR / LSU",dir:"↔ Request/Update",desc:"Link State Request (LSR): 'Send me the full LSA for [type, ID, AdvRouter]'. Link State Update (LSU): delivers the requested full LSAs. LSAs describe router links, network prefixes, and inter-area routes. Stored in LSDB.",pkt:"OSPF LSR: [{type=1 lsid=1.1.1.1}] → LSU: {RouterLSA id=1.1.1.1 links=[{id=10.0.0.0 data=255.255.255.0}]}"},
    {title:"FULL — SPF Runs",dir:"✓ FULL",desc:"LSAck confirms receipt. Both routers reach FULL adjacency state — identical LSDBs. Dijkstra's SPF algorithm computes the shortest-path tree from own Router ID. Routes injected into RIB. On topology change, only affected LSAs reflood.",pkt:"OSPF LSAck | state=FULL | SPF recalculation in 50ms | routes: 10.1.0.0/24 via 10.0.0.2 metric=2"}
  ]}
];

/* ── State ── */
let capPkts=[],capRunning=true,capSel=null,capId=0;
let mainTab="list",sideTab="filters",topTab="capture";
let protoFilter=new Set(Object.keys(PROTO_COLORS));
let attackLogs={};
let protoStep={dhcp:-1,dns:-1,tls:-1,ospf:-1};
let natTable=[],arpTable=[];
let bwData=[],latData=[],ppsData=[];
let quizIdx=0,quizAnswered=false;

/* ── Helpers ── */
function rnd(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
function rip(){return IPS[rnd(0,IPS.length-1)];}
function rmac(){return MACS[rnd(0,MACS.length-1)];}
function fmtTime(t){const d=new Date(t);return`${d.getMinutes().toString().padStart(2,"0")}:${d.getSeconds().toString().padStart(2,"0")}.${d.getMilliseconds().toString().padStart(3,"0")}`;}
function toHex(n,pad=2){return n.toString(16).toUpperCase().padStart(pad,"0");}

/* ── Packet generation ── */
function genPkt(){
  const protoKeys=Object.keys(PROTO_COLORS);
  const proto=protoKeys[rnd(0,protoKeys.length-1)];
  const src=rip(),dst=rip();
  const srcPort=rnd(1024,65535);
  const dstPortMap={ICMP:null,TCP:rnd(1,65535),UDP:rnd(1,65535),HTTP:80,HTTPS:443,DNS:53,DHCP:67,ARP:null,BGP:179,OSPF:null,TLS:443,SSH:22,SMTP:25,SNMP:161,NTP:123};
  const dstPort=dstPortMap[proto];
  const len=rnd(60,1500);
  const infoMap={
    ICMP:`Echo Request id=${rnd(1,9999)} seq=${rnd(1,999)} ttl=64`,
    TCP:`${srcPort} → ${dstPort} [${["SYN","ACK","PSH,ACK","FIN,ACK","RST"][rnd(0,4)]}] Seq=${rnd(1,999999)} Win=${rnd(8192,65535)}`,
    UDP:`${srcPort} → ${dstPort} Len=${len-28}`,
    HTTP:`GET /index.html HTTP/1.1 Host: ${dst} Connection: keep-alive`,
    HTTPS:`Application Data TLSv1.3 len=${len-60} SNI=example.com`,
    DNS:`Standard query A www.example.com | ID=0x${rnd(0,0xffff).toString(16).padStart(4,"0")}`,
    DHCP:["Discover","Offer","Request","ACK"][rnd(0,3)]+` xid=0x${rnd(0,0xffffff).toString(16).padStart(8,"0")}`,
    ARP:`Who has ${dst}? Tell ${src} | opcode=request`,
    BGP:`UPDATE AS_PATH=[${rnd(100,65000)} ${rnd(100,65000)}] NEXT_HOP=${dst} NLRI=${src}/24`,
    OSPF:`Hello routerID=${src} area=0.0.0.0 neighbors=${rnd(1,8)} priority=1`,
    TLS:`ClientHello SNI: www.example.com ciphers=[AES256_GCM_SHA384]`,
    SSH:`Encrypted packet len=${len} seq=${rnd(0,9999)}`,
    SMTP:`EHLO mail.sender.com → 250-mail.${dst} Hello`,
    SNMP:`GetRequest community=public OID=1.3.6.1.2.1.1.1.0 sysDescr`,
    NTP:`NTP v4 Client stratum=3 ref=${rnd(1,4)} poll=6`
  };
  return{id:capId++,time:Date.now(),proto,src,dst,srcPort,dstPort,len,info:infoMap[proto]||proto,mac_src:rmac(),mac_dst:rmac()};
}

function genHexDump(pkt){
  const bytes=[];
  // IP header
  [0x45,0x00,(pkt.len>>8)&0xff,pkt.len&0xff,rnd(0,255),rnd(0,255),0x40,0x00,64,
    {TCP:6,UDP:17,ICMP:1,OSPF:89,BGP:6}[pkt.proto]||17,
    rnd(0,255),rnd(0,255)
  ].forEach(b=>bytes.push(b));
  pkt.src.split(".").forEach(o=>bytes.push(parseInt(o)));
  pkt.dst.split(".").forEach(o=>bytes.push(parseInt(o)));
  // Payload
  for(let i=0;i<Math.min(pkt.len-20,96);i++)bytes.push(rnd(0,255));
  let out="";
  for(let i=0;i<bytes.length;i+=16){
    const row=bytes.slice(i,i+16);
    const hexPart=row.map(b=>toHex(b)).join(" ");
    const asciiPart=row.map(b=>(b>=32&&b<127)?String.fromCharCode(b):".").join("");
    out+=`<span class="hex-offset">${toHex(i,4)}</span>${hexPart.padEnd(47," ")}<span class="hex-ascii"> ${asciiPart}</span>\n`;
  }
  return out;
}

function genDissect(pkt){
  const c=PROTO_COLORS[pkt.proto]||"#9ab5cc";
  const isTCP=["TCP","HTTP","HTTPS","SSH","SMTP","BGP"].includes(pkt.proto);
  const layers=[
    {name:"Frame (Ethernet II)",c:"#8b5cf6",fields:[["Dst MAC",pkt.mac_dst],["Src MAC",pkt.mac_src],["EtherType",pkt.proto==="ARP"?"0x0806 (ARP)":"0x0800 (IPv4)"]]},
    {name:`IPv4 (proto=${pkt.proto==="OSPF"?"89":isTCP?"6 TCP":"17 UDP"})`,c:"#3b82f6",fields:[["Src IP",pkt.src],["Dst IP",pkt.dst],["TTL",rnd(56,128).toString()],["Total Len",pkt.len+" B"],["Flags","DF"],["Identification","0x"+rnd(0,0xffff).toString(16).padStart(4,"0").toUpperCase()]]},
  ];
  if(pkt.srcPort){
    if(isTCP){layers.push({name:"TCP Segment",c:"#00ddff",fields:[["Src Port",pkt.srcPort.toString()],["Dst Port",pkt.dstPort?.toString()||"?"],["Seq Num",rnd(0,999999).toString()],["ACK Num",rnd(0,999999).toString()],["Window",rnd(4096,65535).toString()],["Flags",["SYN","ACK","PSH,ACK","FIN,ACK"][rnd(0,3)]],["Options","NOP NOP SACK"]]});}
    else{layers.push({name:"UDP Datagram",c:"#00ff88",fields:[["Src Port",pkt.srcPort.toString()],["Dst Port",pkt.dstPort?.toString()||"?"],["Length",(pkt.len-28).toString()+" B"],["Checksum","0x"+rnd(0,0xffff).toString(16).toUpperCase()]]});}
  }
  layers.push({name:`${pkt.proto} Payload`,c,fields:[["Info",pkt.info],["Length",(pkt.len-60)+" B"]]});
  return layers.map(l=>`<div style="margin-bottom:5px;padding:6px;background:#040c18;border:1px solid color-mix(in srgb,${l.c} 22%,#040c18);border-radius:2px">
    <div style="font-size:8px;color:${l.c};margin-bottom:5px;letter-spacing:1px">▾ ${l.name}</div>
    ${l.fields.map(([k,v])=>`<div style="display:flex;gap:8px;font-size:8px;margin-bottom:2px"><span style="color:#bfeaff;min-width:80px;flex-shrink:0">${k}</span><span style="color:#9ab5cc;word-break:break-all">${v}</span></div>`).join("")}
  </div>`).join("");
}

/* ── NAT / ARP updates ── */
function updateNAT(p){
  if(["TCP","UDP","HTTP","HTTPS","SSH","SMTP"].includes(p.proto)&&p.srcPort>1023&&natTable.length<18){
    if(!natTable.find(r=>r.privIP===p.src&&r.privPort===p.srcPort)){
      natTable.unshift({privIP:p.src,privPort:p.srcPort,pubIP:"203.0.113.1",pubPort:rnd(10000,65000),dst:p.dst,dstPort:p.dstPort||443,proto:p.proto,ttl:rnd(120,3600)});
      if(natTable.length>15)natTable.pop();
    }
  }
}
function updateARP(p){
  if(p.proto==="ARP"){
    if(!arpTable.find(r=>r.ip===p.src))arpTable.unshift({ip:p.src,mac:p.mac_src,iface:"eth0",ttl:rnd(30,300)});
    if(arpTable.length>12)arpTable.pop();
  }
}

/* ── Capture interval ── */
setInterval(()=>{
  if(!capRunning)return;
  const p=genPkt();
  capPkts.unshift(p);
  if(capPkts.length>200)capPkts.pop();
  updateNAT(p);updateARP(p);
  bwData.push(rnd(10,980));if(bwData.length>60)bwData.shift();
  latData.push(rnd(1,120));if(latData.length>60)latData.shift();
  ppsData.push(rnd(50,800));if(ppsData.length>60)ppsData.shift();
  if(topTab==="capture"&&mainTab==="list")renderCapList();
  if(topTab==="graphs")renderGraph();
  if(topTab==="nat")renderNat();
},200);

/* ── Renders ── */
function renderCapList(){
  const mc=document.getElementById("main-content");
  if(mainTab!=="list")return;
  const visible=capPkts.filter(p=>protoFilter.has(p.proto));
  let h=`<div style="background:#040c18;border-bottom:1px solid #0b1a30;padding:4px 5px;display:flex;gap:5px;align-items:center;flex-shrink:0">
    <span style="font-size:7px;color:#bfeaff;min-width:24px">#</span>
    <span style="font-size:7px;color:#bfeaff;min-width:50px">TIME</span>
    <span style="font-size:7px;color:#bfeaff;min-width:95px">SOURCE</span>
    <span style="font-size:7px;color:#bfeaff;min-width:95px">DESTINATION</span>
    <span style="font-size:7px;color:#bfeaff;min-width:46px">PROTO</span>
    <span style="font-size:7px;color:#bfeaff;min-width:36px;text-align:right">LEN</span>
    <span style="font-size:7px;color:#bfeaff;flex:1">INFO</span>
  </div><div style="flex:1;overflow-y:auto">`;
  visible.slice(0,100).forEach(p=>{
    const c=PROTO_COLORS[p.proto]||"#9ab5cc";
    h+=`<div class="cap-row${capSel===p.id?" sel":""}" onclick="selectPkt(${p.id})">
      <span class="cap-no">${p.id}</span>
      <span class="cap-time">${fmtTime(p.time)}</span>
      <span class="cap-src" style="color:${c}">${p.src}${p.srcPort?":"+p.srcPort:""}</span>
      <span class="cap-dst">${p.dst}${p.dstPort?":"+p.dstPort:""}</span>
      <span class="cap-proto" style="color:${c}">${p.proto}</span>
      <span class="cap-len">${p.len}</span>
      <span class="cap-info">${p.info}</span>
    </div>`;
  });
  h+=`</div>`;
  mc.style.cssText="display:flex;flex-direction:column;overflow:hidden;flex:1";
  mc.innerHTML=h;
}

window.selectPkt=function(id){capSel=id;renderCapList();if(mainTab!=="list")renderMainContent();};

function renderMainContent(){
  const mc=document.getElementById("main-content");
  const pkt=capPkts.find(p=>p.id===capSel);
  mc.style.cssText="display:block;overflow:hidden auto;flex:1";
  if(mainTab==="list"){renderCapList();return;}
  if(mainTab==="detail"){
    if(!pkt){mc.innerHTML=`<div class="panel"><div class="pcard"><div class="ptitle">SELECT A PACKET</div><div class="ptext">Click any row in the Packet List to dissect it here.</div></div></div>`;return;}
    mc.innerHTML=`<div class="panel"><div class="ptitle">PROTOCOL DISSECTION — PKT #${pkt.id} (${pkt.proto})</div>${genDissect(pkt)}</div>`;
  }
  if(mainTab==="hex"){
    if(!pkt){mc.innerHTML=`<div class="panel"><div class="pcard"><div class="ptitle">SELECT A PACKET</div><div class="ptext">Choose a packet from the list first.</div></div></div>`;return;}
    mc.innerHTML=`<div class="panel"><div class="ptitle">HEX DUMP — PKT #${pkt.id} (${pkt.proto} ${pkt.len}B)</div><pre class="hex-grid" style="background:#040c18;border:1px solid #0b1a30;border-radius:2px;padding:8px;font-size:8px;line-height:2;overflow-x:auto">${genHexDump(pkt)}</pre></div>`;
  }
  if(mainTab==="stream"){
    const streams=capPkts.filter(p=>["TCP","HTTP","HTTPS"].includes(p.proto)).slice(0,12);
    mc.innerHTML=`<div class="panel"><div class="ptitle">TCP STREAM RECONSTRUCTION</div>
    ${streams.map(p=>{const c=PROTO_COLORS[p.proto];return`<div style="margin-bottom:5px;padding:5px 7px;background:#040c18;border-left:2px solid ${c};border-radius:0 2px 2px 0"><div style="display:flex;justify-content:space-between;margin-bottom:2px"><span style="font-size:8px;color:${c}">${p.src}:${p.srcPort} → ${p.dst}:${p.dstPort}</span><span style="font-size:7px;color:#bfeaff">${fmtTime(p.time)}</span></div><div style="font-size:8px;color:#3a6080">${p.info}</div></div>`;}).join("")}
    <div class="pcard" style="margin-top:8px"><div class="ptitle">ABOUT TCP STREAMS</div><div class="ptext">TCP streams are bidirectional byte sequences identified by a 5-tuple (src IP, src port, dst IP, dst port, proto). Wireshark reconstructs application-layer data by sorting segments by sequence number and reassembling the payload bytes. Useful for extracting HTTP content, credentials, and file transfers from captures.</div></div></div>`;
  }
}

function renderSidebar(){
  const sc=document.getElementById("sidebar-content");
  if(sideTab==="filters"){
    sc.innerHTML=`<span class="slbl">CAPTURE CONTROLS</span>
      <div style="display:flex;gap:4px;margin-bottom:8px">
        <button class="btn-sm${capRunning?" btn-ok":""}" id="cap-tog">${capRunning?"⏸ Pause":"▶ Resume"}</button>
        <button class="btn-sm btn-danger" id="cap-clr">🗑 Clear</button>
      </div>
      <div style="font-size:8px;color:#bfeaff;margin-bottom:8px">${capPkts.length} packets captured</div>
      <span class="slbl">PROTOCOL FILTER</span>
      <div style="display:flex;gap:3px;flex-wrap:wrap">
        ${Object.entries(PROTO_COLORS).map(([k,c])=>`<button class="btn-sm" style="${protoFilter.has(k)?`border-color:${c};color:${c};background:color-mix(in srgb,${c} 10%,#040c18)`:""}" onclick="toggleFilter('${k}')">${k}</button>`).join("")}
      </div>`;
    document.getElementById("cap-tog")?.addEventListener("click",()=>{capRunning=!capRunning;const s=document.getElementById("cap-status");s.textContent=capRunning?"● CAPTURING":"◌ PAUSED";s.style.color=capRunning?"#00ff88":"#ffc700";renderSidebar();});
    document.getElementById("cap-clr")?.addEventListener("click",()=>{capPkts=[];capSel=null;renderCapList();renderSidebar();});
  }
  if(sideTab==="legend"){
    sc.innerHTML=`<span class="slbl">PROTOCOL COLORS</span>
    ${Object.entries(PROTO_COLORS).map(([k,c])=>`<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;padding:3px 5px;background:#040c18;border-radius:2px"><div style="width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0"></div><span style="font-size:9px;color:${c}">${k}</span></div>`).join("")}`;
  }
  if(sideTab==="ref"){
    sc.innerHTML=`<span class="slbl">QUICK REFERENCE</span>
    ${[["TCP 6","Connection-oriented, reliable, ordered"],["UDP 17","Connectionless, fast, best-effort"],["ICMP 1","Diagnostics: ping, traceroute"],["OSPF 89","Link-state IGP routing"],["Port 80","HTTP — cleartext web"],["Port 443","HTTPS / TLS encrypted"],["Port 53","DNS — name resolution (UDP)"],["Port 67/68","DHCP — IP assignment"],["Port 22","SSH — secure shell"],["Port 25","SMTP — email relay"],["Port 179","BGP — inter-AS routing"],["Port 161","SNMP — net management"],["Port 123","NTP — time sync"],["Port 443","TLS 1.3 — encryption layer"]].map(([k,v])=>`<div style="padding:3px 0;border-bottom:1px solid #050c18"><div style="display:flex;justify-content:space-between"><span style="font-size:8px;color:#9ab5cc">${k}</span></div><div style="font-size:7px;color:#bfeaff">${v}</div></div>`).join("")}`;
  }
}
window.toggleFilter=function(k){if(protoFilter.has(k))protoFilter.delete(k);else protoFilter.add(k);renderSidebar();renderCapList();};

function renderAttacks(){
  const mc=document.getElementById("main-content");
  mc.style.cssText="display:block;overflow:hidden auto;flex:1";
  let h=`<div class="panel">`;
  ATTACK_DATA.forEach(a=>{
    const log=attackLogs[a.id]||[];
    h+=`<div class="atk-card">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
        <span class="atk-name">${a.name}</span>
        <span style="font-size:7px;padding:1px 5px;border:1px solid ${a.color};border-radius:2px;color:${a.color}">${a.layer}</span>
      </div>
      <div class="atk-desc">${a.desc}</div>
      <div class="flex">
        <button class="atk-btn" data-atk="${a.id}" data-type="atk">⚔️ Simulate Attack</button>
        <button class="def-btn" data-atk="${a.id}" data-type="def">🛡️ Apply Defense</button>
      </div>
      ${log.length?`<div class="atk-log">${log.map(s=>`<div class="atk-step atk-${s.t}">${s.m}</div>`).join("")}</div>`:""}
    </div>`;
  });
  h+=`</div>`;
  mc.innerHTML=h;
  mc.querySelectorAll("[data-atk]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id=btn.dataset.atk,type=btn.dataset.type;
      const atk=ATTACK_DATA.find(a=>a.id===id);if(!atk)return;
      const steps=atk.steps[type]||[];attackLogs[id]=[];
      let i=0;const t=setInterval(()=>{if(i<steps.length){attackLogs[id].push(steps[i++]);renderAttacks();}else clearInterval(t);},500);
    });
  });
}

function renderProtocols(){
  const mc=document.getElementById("main-content");
  mc.style.cssText="display:block;overflow:hidden auto;flex:1";
  let h=`<div class="panel">`;
  PROTO_WALKTHROUGHS.forEach(proto=>{
    const step=protoStep[proto.id];
    h+=`<div class="pcard" style="margin-bottom:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div class="ptitle" style="color:${proto.color};margin:0;letter-spacing:2px">${proto.name}</div>
        <div style="display:flex;gap:4px">
          <button class="btn-sm" data-proto="${proto.id}" data-n="-1">↺ Reset</button>
          <button class="btn-sm btn-primary" data-proto="${proto.id}" data-n="${Math.min(step+1,proto.steps.length-1)}">▶ Next</button>
        </div>
      </div>
      ${proto.steps.map((s,i)=>{
        const state=i<step?"done":i===step?"active":"";
        return`<div class="proto-step${state?" "+state:""}" data-proto="${proto.id}" data-n="${i}">
          <div class="ps-num" style="${state==="done"?"border-color:#00ff88;color:#00ff88":state==="active"?"border-color:#ffc700;color:#ffc700":"border-color:#0b1a30;color:#bfeaff"}">${i+1}</div>
          <div style="flex:1">
            <div class="ps-title" style="color:${state==="done"?"#00ff88":state==="active"?"#ffc700":proto.color}">${s.title} <span style="font-size:7px;font-weight:normal;color:#bfeaff">${s.dir}</span></div>
            ${state==="active"||state==="done"?`<div class="ps-desc">${s.desc}</div><div class="ps-pkt">${s.pkt}</div>`:`<div style="font-size:8px;color:#bfeaff">${s.dir}</div>`}
          </div>
        </div>`;
      }).join("")}
    </div>`;
  });
  h+=`</div>`;
  mc.innerHTML=h;
  mc.querySelectorAll("[data-proto]").forEach(el=>{
    el.addEventListener("click",()=>{protoStep[el.dataset.proto]=parseInt(el.dataset.n);renderProtocols();});
  });
}

function renderNat(){
  const mc=document.getElementById("main-content");
  mc.style.cssText="display:block;overflow:hidden auto;flex:1";
  mc.innerHTML=`<div class="panel">
    <div class="pcard">
      <div class="ptitle">NAT TRANSLATION TABLE (PAT / Overload) — ${natTable.length} sessions</div>
      <div style="overflow-x:auto">
      <table class="nat-table"><thead><tr><th>PRIVATE IP</th><th>PRIV PORT</th><th>PUBLIC IP</th><th>PUB PORT</th><th>DEST IP</th><th>DEST PORT</th><th>PROTO</th><th>TTL</th></tr></thead>
      <tbody>${natTable.map(r=>`<tr><td>${r.privIP}</td><td style="color:#00ddff">${r.privPort}</td><td style="color:#fb923c">${r.pubIP}</td><td style="color:#fb923c">${r.pubPort}</td><td>${r.dst}</td><td>${r.dstPort}</td><td style="color:${PROTO_COLORS[r.proto]||"#9ab5cc"}">${r.proto}</td><td>${r.ttl}s</td></tr>`).join("")}</tbody>
      </table></div>
    </div>
    <div class="pcard">
      <div class="ptitle">ARP CACHE — ${arpTable.length} entries</div>
      ${arpTable.map(r=>`<div class="arp-cell"><span class="arp-ip">${r.ip}</span><span class="arp-mac">${r.mac}</span><div style="text-align:right"><div style="font-size:7px;color:#bfeaff">${r.iface}</div><span class="arp-ttl">TTL: ${r.ttl}s</span></div></div>`).join("")}
      ${arpTable.length===0?`<div class="ptext">ARP entries will populate as packets are captured...</div>`:""}
    </div>
    <div class="pcard"><div class="ptitle">NAT TYPES EXPLAINED</div>
      <div class="ptext">
        <span style="color:#fb923c">Static NAT</span> — 1:1 mapping. One public IP per internal host. Used for hosting public servers.<br><br>
        <span style="color:#fb923c">Dynamic NAT</span> — Pool of public IPs, assigned on demand. Still 1:1 at any given moment.<br><br>
        <span style="color:#fb923c">PAT / Overload</span> — Many-to-one using port numbers. Standard for home/office. All hosts share one public IP, differentiated by src port. Router tracks {priv IP:port ↔ pub IP:port} in the NAT table.<br><br>
        <span style="color:#fb923c">NAT64</span> — Translates IPv6 ↔ IPv4. Lets IPv6-only clients reach IPv4 servers.<br><br>
        <span style="color:#ffc700">Limitation:</span> NAT breaks end-to-end connectivity — no unsolicited inbound. VPN, STUN/TURN, UPnP, and port forwarding work around this.
      </div>
    </div>
  </div>`;
}

function renderGraph(){
  const mc=document.getElementById("main-content");
  mc.style.cssText="display:block;overflow:hidden auto;flex:1";
  const avgBw=bwData.length?Math.round(bwData.reduce((a,b)=>a+b,0)/bwData.length):0;
  const avgLat=latData.length?Math.round(latData.reduce((a,b)=>a+b,0)/latData.length):0;
  mc.innerHTML=`<div class="panel">
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
      ${[["Avg Bandwidth",avgBw+" Mbps","#00e5ff"],["Avg Latency",avgLat+" ms","#ffc700"],["Total Packets",capPkts.length,"#00ff88"]].map(([k,v,c])=>`<div style="background:#040c18;border:1px solid #0b1a30;border-radius:2px;padding:8px;text-align:center"><div style="font-size:7px;color:#bfeaff;letter-spacing:2px;margin-bottom:3px">${k}</div><div style="font-size:14px;font-weight:700;color:${c}">${v}</div></div>`).join("")}
    </div>
    <div class="graph-wrap"><div class="graph-title">BANDWIDTH (Mbps)</div><canvas id="g-bw" width="560" height="90"></canvas></div>
    <div class="graph-wrap"><div class="graph-title">LATENCY (ms)</div><canvas id="g-lat" width="560" height="90"></canvas></div>
    <div class="graph-wrap"><div class="graph-title">PACKETS / SEC</div><canvas id="g-pps" width="560" height="90"></canvas></div>
    <div class="pcard"><div class="ptitle">PROTOCOL DISTRIBUTION</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        ${Object.entries(PROTO_COLORS).map(([k,c])=>{const cnt=capPkts.filter(p=>p.proto===k).length;const pct=capPkts.length?Math.round(cnt/capPkts.length*100):0;return cnt?`<div style="display:flex;align-items:center;gap:4px;padding:2px 7px;background:#050c18;border:1px solid ${c}30;border-radius:2px"><div style="width:6px;height:6px;border-radius:50%;background:${c}"></div><span style="font-size:8px;color:${c}">${k}</span><span style="font-size:8px;color:#bfeaff">${pct}%</span></div>`:""}).join("")}
      </div>
    </div>
  </div>`;
  setTimeout(()=>{
    drawGraph("g-bw",bwData,"#00e5ff",1000);
    drawGraph("g-lat",latData,"#ffc700",150);
    drawGraph("g-pps",ppsData,"#00ff88",1000);
  },30);
}

function drawGraph(id,data,color,maxVal){
  const c=document.getElementById(id);if(!c)return;
  const ctx=c.getContext("2d");const w=c.width,h=c.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle="#040c18";ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="#0b1a30";ctx.lineWidth=0.5;
  for(let i=1;i<5;i++){const y=h/5*i;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  if(!data.length)return;
  const step=w/60;
  ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=1.5;
  data.forEach((v,i)=>{const x=step*i,y=h-(v/maxVal*h*0.9+h*0.05);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
  ctx.stroke();
  ctx.beginPath();ctx.fillStyle=color+"18";
  data.forEach((v,i)=>{const x=step*i,y=h-(v/maxVal*h*0.9+h*0.05);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
  ctx.lineTo(step*(data.length-1),h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();
  if(data.length>0){ctx.fillStyle=color;ctx.font="9px monospace";ctx.fillText(Math.round(data[data.length-1]).toString(),w-44,14);}
}

function renderQuiz(){
  const mc=document.getElementById("main-content");
  mc.style.cssText="display:block;overflow:hidden auto;flex:1";
  const q=QUIZ[quizIdx];
  mc.innerHTML=`<div class="panel">
    <div style="display:flex;justify-content:space-between;margin-bottom:8px;align-items:center">
      <span style="font-size:7px;color:#1a3a58;letter-spacing:2px">QUESTION ${quizIdx+1} / ${QUIZ.length}</span>
      <span style="font-size:7px;color:#00e5ff;letter-spacing:1px">NETWORKING FUNDAMENTALS</span>
    </div>
    <div class="pcard">
      <div style="width:${Math.round((quizIdx/QUIZ.length)*100)}%;height:2px;background:#00e5ff;border-radius:1px;margin-bottom:10px;transition:width 0.3s"></div>
      <div class="quiz-q">${q.q}</div>
      ${q.opts.map((o,i)=>`<button class="quiz-opt" data-opt="${i}">${String.fromCharCode(65+i)}) ${o}</button>`).join("")}
      <div class="quiz-explain" id="quiz-exp">${q.explain}</div>
      <button class="quiz-next" id="quiz-nxt">${quizIdx<QUIZ.length-1?"Next Question →":"Start Over ↺"}</button>
    </div>
    <div class="pcard"><div class="ptitle">EXAM STUDY TIPS</div>
      <div class="ptext">
        ▸ CCNA: OSI, TCP/IP, subnetting, VLANs, STP, OSPF, NAT, ACLs, CDP/LLDP<br>
        ▸ Subnetting: /24=254 hosts, /25=126, /26=62, /27=30, /28=14, /29=6, /30=2<br>
        ▸ STP states: Blocking → Listening → Learning → Forwarding (Disabled)<br>
        ▸ AD values: Connected=0, Static=1, OSPF=110, RIP=120, eBGP=20, iBGP=200<br>
        ▸ TCP 3-way: SYN → SYN-ACK → ACK | Teardown: FIN→ACK→FIN→ACK<br>
        ▸ DHCP DORA: Discover → Offer → Request → ACK (all broadcast except ACK)<br>
        ▸ DNS hierarchy: Root (.) → TLD (.com) → Authoritative → Client
      </div>
    </div>
  </div>`;
  quizAnswered=false;
  mc.querySelectorAll("[data-opt]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      if(quizAnswered)return;quizAnswered=true;
      const i=parseInt(btn.dataset.opt);
      btn.className="quiz-opt "+(i===q.ans?"correct":"wrong");
      if(i!==q.ans)mc.querySelectorAll("[data-opt]")[q.ans].className="quiz-opt correct";
      document.getElementById("quiz-exp").style.display="block";
      document.getElementById("quiz-nxt").style.display="inline-block";
    });
  });
  document.getElementById("quiz-nxt")?.addEventListener("click",()=>{quizIdx=(quizIdx+1)%QUIZ.length;renderQuiz();});
}

function renderAll(){
  renderSidebar();
  const sidebar=document.getElementById("sidebar");
  const mainTabs=document.getElementById("main-tabs");
  if(topTab==="capture"){
    sidebar.style.display="flex";mainTabs.style.display="flex";renderCapList();
  } else if(topTab==="attacks"){
    sidebar.style.display="none";mainTabs.style.display="none";renderAttacks();
  } else if(topTab==="protocols"){
    sidebar.style.display="none";mainTabs.style.display="none";renderProtocols();
  } else if(topTab==="nat"){
    sidebar.style.display="none";mainTabs.style.display="none";renderNat();
  } else if(topTab==="graphs"){
    sidebar.style.display="none";mainTabs.style.display="none";renderGraph();
  } else if(topTab==="quiz"){
    sidebar.style.display="none";mainTabs.style.display="none";renderQuiz();
  }
}

/* ── Event bindings ── */
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{
  topTab=b.dataset.t;
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("on",x.dataset.t===topTab));
  renderAll();
}));
document.querySelectorAll(".stab").forEach(b=>b.addEventListener("click",()=>{
  sideTab=b.dataset.st;
  document.querySelectorAll(".stab").forEach(x=>x.classList.toggle("on",x.dataset.st===sideTab));
  renderSidebar();
}));
document.querySelectorAll(".mtab").forEach(b=>b.addEventListener("click",()=>{
  mainTab=b.dataset.mt;
  document.querySelectorAll(".mtab").forEach(x=>x.classList.toggle("on",x.dataset.mt===mainTab));
  renderMainContent();
}));

/* ── Init ── */
renderAll();
