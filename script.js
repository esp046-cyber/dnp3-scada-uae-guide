/* DNP3 SCADA UAE Field Engineer Guide - script.js */
(function () {
  'use strict';

  var SEV = { C: 'Critical', H: 'High', M: 'Medium', L: 'Low' };
  var SEV_RANK = { C: 0, H: 1, M: 2, L: 3 };

  // [tags (first = category), severity, title, detail, UAE field note, copyable snippet]
  var RAW = [
    // ---------- Protocol fundamentals ----------
    ["Protocol","H","Match conformance levels in both Device Profiles","Higher DNP3 levels add object variations, event types and fragment handling. Compare the master and outstation Device Profile Documents line by line before FAT, not on site.","Ask the vendor for the signed profile; DEWA/SEWA FAT sheets usually reference it.",""],
    ["Protocol,HexAnalysis","H","Startup integrity poll: Class 0, then 1, 2, 3","After connect or Device Restart, read Class 0 for static data then classes 1-3 to drain buffered events. Treat static data as unverified until this completes.","","C0 01 3C 02 06 3C 03 06 3C 04 06 3C 01 06"],
    ["Protocol","M","Do not poll Class 0 fast","Class 0 returns every static point and can be very large. Run it every 15-60 minutes as a safety net and use event polls for routine updates.","Serial RTUs on 9600 baud or radio links saturate quickly.",""],
    ["Protocol","M","Poll event classes every 2-10 s on serial","An event poll with nothing pending is a tiny exchange. Pick the interval from the slowest SOE latency the control centre accepts.","",""],
    ["Protocol,DEWA","H","Assign classes by operational priority","Typical split: Class 1 breaker status and protection trips, Class 2 analogues and tap position, Class 3 counters and diagnostics. Record it in the point list.","Agree the mapping with the control centre before commissioning; changes force retesting.",""],
    ["Protocol","H","Enable unsolicited after the startup handshake","The outstation sends a null unsolicited response after restart; the master confirms it, then sends Enable Unsolicited (FC 0x14). Until then events only reach polls.","","C0 14 3C 02 06 3C 03 06 3C 04 06"],
    ["Protocol","M","Keep a slow integrity poll with unsolicited on","Unsolicited messages can be lost. A Class 0 poll every 30-60 minutes repairs silent drift between master and RTU databases.","",""],
    ["Protocol,Serial","H","Avoid unsolicited on shared half-duplex serial","Two outstations transmitting together corrupt each other's frames. Use polling on multi-drop RS-485 unless the design has collision control.","Radio and multi-drop feeder loops are the usual offenders.",""],
    ["Protocol","M","Static data vs event data","Static objects (g1, g30) hold the current value. Event objects (g2, g32) are buffered changes with optional timestamps. Reading events does not refresh static values.","",""],
    ["Protocol","H","Pick the analogue variation to avoid 16-bit overflow","g30v1 is 32-bit with flags, g30v2 is 16-bit with flags. 16-bit raw values overflow past 32767 (signed). Scale in the RTU or use 32-bit or float (g30v5).","MW and kV values on 132 kV circuits easily exceed 16-bit raw scaling.","01 1E 01 06"],
    ["Protocol","M","Float variations differ between masters","g30v5 single-precision float is exact, but some master drivers expect integer counts plus scale factors. Confirm the driver before FAT.","",""],
    ["Protocol","H","Set deadband as a percentage of span","0.5-1% of full scale is a typical analogue event deadband. Zero or tiny deadbands flood the event buffer and trigger Event Buffer Overflow.","Noisy CT/VT inputs on 11 kV feeders need larger deadbands.",""],
    ["Protocol","M","Use absolute deadbands for frequency","Frequency, angle and tap position need engineering-unit deadbands (for example 0.02 Hz), not a percentage of span.","",""],
    ["Protocol,HexAnalysis","M","Timestamped binary events","g2v2 carries absolute time. g2v3 uses relative time and needs a g51 CTO object ahead of it. Verify the master handles CTO before choosing v3.","",""],
    ["Protocol","M","Debounce binary inputs in the RTU","10-20 ms debounce on DC-fed contacts removes chatter without hiding real trips. Use a chatter filter for repeated toggling.","",""],
    ["Protocol","H","Use frozen counters for energy and billing","Static counters keep running. Send Immediate Freeze (FC 0x07) on g20, then read g21 so every device reports the same instant.","","C0 07 14 01 06"],
    ["Protocol","L","Handle counter rollover","32-bit counters wrap at 4,294,967,295. The master must calculate differences modulo 2^32 for energy totals.","",""],
    ["Protocol","C","Use SBO for breakers and isolators","Select-Before-Operate validates and arms the target before execution. Keep Direct Operate for low-risk points such as fans or lamps.","DEWA 132/11 kV control normally requires SBO.",""],
    ["Protocol,HexAnalysis","H","SBO sequence rules","Operate must repeat the Select objects exactly (index, control code, count, times) with application sequence = Select sequence + 1, inside the select timeout.","","03 0C 01 17 01 05 11 01 64 00 00 00 00 00 00 00 00"],
    ["Protocol","H","Align the select timeout","Typical select timeout is 5-10 s. If the operator is slower, Operate returns status 1 (timeout). Set the same value in master and RTU.","",""],
    ["Protocol","M","Know your CROB control codes","Pulse close 0x11, pulse trip 0x21, latch on 0x03, latch off 0x04. Many relays accept only specific codes, so configure per relay type.","",""],
    ["Protocol,Troubleshooting","H","Read control status codes","0 Success, 1 Timeout, 2 No select, 3 Format error, 4 Not supported, 7 Local, 8 Too many operations. Status 7 means the Local/Remote switch is in Local.","",""],
    ["Protocol","M","Match pulse widths to the breaker coil","Typical 100-500 ms close/trip pulses. A pulse shorter than the coil needs gives a successful response but no operation.","",""],
    ["Protocol,Troubleshooting","H","Send time in UTC only","DNP3 time is 48-bit milliseconds since 1970 UTC. The UAE is UTC+4 with no daylight saving. Never send local time.","",""],
    ["Protocol","M","Use Delay Measurement on slow links","FC 0x17 measures channel delay so the master can compensate the time write. Use it on radio and low-baud serial channels.","",""],
    ["Protocol","H","Synchronise on Need Time or every 10-60 min","IIN1.4 (Need Time) requests a g50v1 write. Regular syncing limits drift; prefer GPS or NTP at the RTU where available.","",""],
    ["Protocol,Troubleshooting","M","Match maximum fragment sizes","The default maximum fragment is commonly 2048 bytes. If the master receive buffer is smaller, responses are truncated or dropped.","",""],
    ["Protocol","M","Application Confirm clears events","Events stay buffered until the application Confirm (FC 0x00) arrives. Lost confirms cause resent events and duplicate alarms.","",""],
    ["Protocol","M","Set response timeouts from link speed","Serial 3-10 s, radio 5-15 s, IP 2-5 s are typical. Too short causes false retries and repeated controls.","",""],
    ["Protocol,Ethernet","M","Use unconfirmed link layer on IP","Use link function 0x04 (unconfirmed user data) over TCP. TCP already guarantees delivery and link confirms double the traffic.","",""],
    ["Protocol,Troubleshooting","C","Never use reserved link addresses","0xFFF0-0xFFFF are reserved and 0xFFFF is broadcast. Use unique addresses below 65520 for every master and outstation.","",""],
    ["Protocol,Troubleshooting","H","Confirm point index base","Vendors mix zero-based and one-based indexing. An off-by-one index is the commonest cause of Object Unknown and wrong-tag data.","",""],
    ["Protocol","M","Version-control the point list","Keep the DNP3 point list with revision, date and signatory. Every RTU change needs an updated list before it goes live.","",""],
    ["Protocol,Ethernet","M","Know the default TCP ports","DNP3 over TCP uses port 20000 by default. IEC 60870-5-104 uses 2404. Confirm firewall rules in both directions.","",""],

    // ---------- Serial / RS-485 ----------
    ["Serial","H","Choose 2-wire or 4-wire deliberately","2-wire is half-duplex and needs direction control. 4-wire gives full duplex for point-to-point links where unsolicited reporting is wanted.","",""],
    ["Serial","C","Terminate 120 ohm at the two ends only","Fit a 120 ohm resistor at each physical end of the bus and nowhere else. Terminating every drop loads the line and weakens the signal.","",""],
    ["Serial","H","Bias at one point only","Fail-safe bias holds the idle state. Fit pull-up and pull-down (typically 450-650 ohm) at the master or converter only, and confirm differential idle at 200 mV or more.","",""],
    ["Serial","M","Use proper twisted-pair cable","Use one shielded twisted pair of about 120 ohm impedance. Ground the shield at one end only.","",""],
    ["Serial","H","Match baud, parity and stop bits everywhere","Typical settings 9600 8N1 up to 115200. Every device on the bus must match exactly; a mismatch shows as noise instead of 05 64.","",""],
    ["Serial","M","Baud rate versus distance","Roughly 9600 baud suits up to 1200 m; 115200 baud is reliable only over a few hundred metres. Reduce baud before replacing cable.","",""],
    ["Serial","M","Calculate frame time","A maximum 292-byte frame at 9600 baud takes about 0.3 s. Use this to set poll intervals and timeouts on slow channels.","",""],
    ["Serial","M","Use RTS/CTS correctly with radios and modems","Set RTS-to-data delay of 20-50 ms for radio key-up and enable CTS handshaking only where the device actually asserts it.","",""],
    ["Serial","M","Allow converter turnaround time","RS-232/RS-485 converters need a turnaround delay of at least two character times to avoid truncating the first bytes.","",""],
    ["Serial","M","Limit the bus to 32 unit loads","Use repeaters or low-load transceivers beyond 32 nodes, and avoid star wiring. Keep stubs under 0.5 m.","",""],
    ["Serial,Environment","H","Use fibre transceivers between buildings","Optical RS-485/RS-232 converters remove ground potential problems. Match multimode (850 nm) or single-mode (1310 nm) and check the power budget.","Needed between control building and switchyard kiosks.",""],
    ["Serial,Troubleshooting","M","Check A/B polarity","Labels vary between vendors. If the bus is silent and the idle line is wrong, swap A and B at one device.","",""],

    // ---------- Ethernet ----------
    ["Ethernet","H","Isolate telemetry in its own VLAN","Use a dedicated 802.1Q VLAN for SCADA, avoid VLAN 1, and trunk only the VLANs needed.","",""],
    ["Ethernet,Cybersecurity","H","Use managed switches and disable unused ports","Enable port security, shut unused ports and log link changes. Unmanaged switches hide faults.","",""],
    ["Ethernet","M","Plan ring recovery time","RSTP takes seconds to converge. Use vendor rings, PRP or HSR where sub-100 ms recovery is required.","",""],
    ["Ethernet,Troubleshooting","H","Fix duplex and speed mismatches","Set auto-negotiation on both ends, or fix both to the same speed and full duplex. Mismatches cause late collisions and CRC errors.","",""],
    ["Ethernet","M","Fibre link budget","100BASE-FX multimode typically reaches about 2 km. Check SFP transmit and receive dBm before blaming the RTU.","",""],
    ["Ethernet,Environment","M","Keep copper short and shielded outdoors","Cat6 is limited to 100 m. Use shielded cable inside the substation and fibre for anything leaving the building.","",""],
    ["Ethernet","M","Use static addressing for RTUs","Document IP, mask and gateway per RTU. Avoid DHCP on field devices.","",""],
    ["Ethernet","H","Set TCP keepalive below firewall idle time","A 5-15 s keepalive detects half-open sessions faster than firewall idle timers drop them.","",""],
    ["Ethernet","M","Plan redundant master connections","Confirm which master receives unsolicited responses when the RTU accepts two TCP sessions.","",""],
    ["Ethernet,Serial","M","Tune serial terminal servers","Disable Nagle, set a 10-20 ms packet timeout and keep baud, parity and stop bits identical to the serial side.","",""],
    ["Ethernet","H","Choose NTP or PTP for time","Use SNTP for general IP devices and PTP (IEEE C37.238 power profile) in substations. Keep DNP3 time sync as fallback.","",""],
    ["Ethernet,DEWA","H","Document protocol converter mapping","IEC 104 to DNP3 gateways need mapping of common object types, cause of transmission, time quality and double-point status.","Keep the mapping table with the FAT report.",""],

    // ---------- Cybersecurity ----------
    ["Cybersecurity,DEWA","H","Follow DESC and UAE IA requirements","Confirm the current Dubai Electronic Security Center ISR and UAE IA Regulation requirements for each site and obtain approvals before connecting devices.","Requirements change; confirm with the utility's security team.",""],
    ["Cybersecurity","C","Allow only master-to-RTU traffic","Permit the master IP to the RTU on port 20000 and deny everything else with a stateful firewall.","",""],
    ["Cybersecurity","H","Disable unused RTU services","Turn off HTTP, Telnet and FTP unless needed. Change default passwords at installation.","",""],
    ["Cybersecurity","M","Evaluate DNP3 Secure Authentication","IEEE 1815 Secure Authentication v5 protects critical commands. Confirm support in both master and RTU before specifying.","",""],
    ["Cybersecurity","H","Use a dedicated commissioning laptop","Scan it before use, keep it patched and never connect it to corporate and SCADA networks at the same time.","",""],
    ["Cybersecurity","M","Back up and baseline RTU configuration","Store configs with a checksum after SAT. Compare against the baseline after any fault or maintenance.","",""],

    // ---------- Environment ----------
    ["Environment","C","Design for +55 C inside the kiosk","Solar load adds 10-20 K above ambient inside outdoor RTU kiosks. Verify every component's rated temperature and use sunshields.","Summer kiosks in Dubai routinely exceed 60 C inside.",""],
    ["Environment","H","Check thermal derating curves","Many power supplies and drives derate above 50-60 C. Read the datasheet curve rather than assuming full output.","",""],
    ["Environment","H","Account for battery life at high temperature","Battery life roughly halves for every 8-10 C above 25 C. Use temperature-compensated charging and shorter replacement cycles.","",""],
    ["Environment","M","Use shade, double-skin roofs and light paint","Passive cooling lowers internal temperature without adding fans that clog with sand.","",""],
    ["Environment","M","Control sand ingress","Use sealed enclosures or filtered positive-pressure fans and clean filters on a schedule.","",""],
    ["Environment","M","Prevent night-time condensation","Large day-night swings cause condensation. Use thermostat-controlled heaters and breathers.","",""],
    ["Environment,DEWA","C","Specify IP66 / NEMA 4X for coastal sites","Jebel Ali and creek-side sites need IP66 or NEMA 4X, 316L stainless hardware and sealed cable glands.","",""],
    ["Environment","H","Apply conformal coating","Coat PCBs per IPC-CC-830 where salt air is present. Mask connectors and heat sinks.","",""],
    ["Environment","M","Avoid dissimilar metals","Galvanic corrosion eats terminals and glands in saline air. Use compatible metals and isolating washers.","",""],
    ["Environment","H","Protect with surge arresters","Fit SPDs on power, signal and fibre-entry copper. Check earthing resistance at commissioning.","",""],
    ["Environment","M","Improve high-resistance earthing","Sandy soil gives poor earth. Use earth enhancement compound and measure resistance at SAT.","",""],
    ["Environment","M","Size solar RTUs for dust","Allow 2-3 days autonomy and a panel cleaning schedule; dust cuts output sharply.","",""],

    // ---------- UAE utility ----------
    ["DEWA","H","Confirm substation architecture early","132/11 kV sites typically pass data from RTUs or gateways to SCADA/DMS/EMS. Get the utility's data flow diagram first.","",""],
    ["DEWA","H","Map double-point indications explicitly","DNP3 has no native double-point object. Map as two binary inputs and define how intermediate and invalid states are handled.","",""],
    ["DEWA,Troubleshooting","H","Handle Local/Remote correctly","IIN1.5 Local Control and control status 7 indicate Local mode. Interlock operator permits with the Local/Remote status point.","",""],
    ["DEWA","M","Use utility-specific specifications","DEWA, SEWA, FEWA and ENOC each issue their own interface specifications. Follow the tender documents over generic examples.","",""],
    ["DEWA","M","District cooling plants need scaling agreements","Chilled-water flows, temperatures and power need agreed engineering-unit scaling between BMS and SCADA.","",""],
    ["DEWA","M","Display in GST but transport UTC","Show UTC+4 on the HMI but store and transmit UTC.","",""],

    // ---------- Hex analysis ----------
    ["HexAnalysis","H","Look for 05 64 first","Every DNP3 data link frame starts with 0x05 0x64. If it is missing, check baud rate, protocol selection or noise.","","05 64"],
    ["HexAnalysis","M","Length byte excludes CRCs","LEN = 5 plus user data bytes. 0x14 means 15 bytes of user data; CRC bytes are not counted.","",""],
    ["HexAnalysis","H","Decode the link control byte","0xC4 is master to outstation, unconfirmed user data; 0x44 is outstation to master. Bit 7 DIR, bit 6 PRM.","","C4"],
    ["HexAnalysis","M","Addresses are little-endian","Bytes 0A 00 mean address 10. Destination comes first, then source.","","0A 00 01 00"],
    ["HexAnalysis","H","Check CRC blocks","Header and every 16-byte data block carry a CRC-16 (polynomial 0x3D65) sent low byte first. A failed CRC discards the whole frame.","",""],
    ["HexAnalysis","M","Read the transport header","0xC0 means first and final fragment, sequence 0. FIR is bit 7, FIN bit 6, SEQ the low six bits.","","C0"],
    ["HexAnalysis","M","Read the application control byte","FIR 0x80, FIN 0x40, CON 0x20, UNS 0x10, sequence in bits 0-3. Unsolicited responses set UNS.","",""],
    ["HexAnalysis","H","Memorise function codes","01 Read, 02 Write, 03 Select, 04 Operate, 05 Direct Operate, 14 Enable Unsolicited, 81 Response, 82 Unsolicited Response.","",""],
    ["HexAnalysis,Troubleshooting","H","Responses carry IIN after the function code","Response 0x81 is followed by two IIN bytes: 81 00 00 means nothing is flagged.","","81 00 00"],
    ["HexAnalysis","M","Decode IIN1","Bit 0 Broadcast, 1 Class 1 events, 2 Class 2, 3 Class 3, 4 Need Time, 5 Local Control, 6 Device Trouble, 7 Device Restart.","","80 00"],
    ["HexAnalysis","M","Decode IIN2","Bit 0 No function code support, 1 Object unknown, 2 Parameter error, 3 Event buffer overflow, 4 Already executing, 5 Configuration corrupt.","",""],
    ["HexAnalysis","M","Read object headers","Group, variation, qualifier. 3C 02 06 is Class 1 all objects; 3C 01 06 is Class 0.","","3C 02 06"],
    ["HexAnalysis","L","Common qualifier codes","06 all objects, 00 and 01 start-stop, 07 and 08 count, 17 and 28 count with index prefix.","",""],
    ["HexAnalysis","H","Clear Device Restart","Write g80 v1 index 7 to 0 once the master has re-initialised.","","C0 02 50 01 00 07 07 00"],

    // ---------- Troubleshooting ----------
    ["Troubleshooting","H","No response: work through a fixed sequence","Check power, link LEDs, address, baud/parity, A/B polarity and termination in that order.","",""],
    ["Troubleshooting,Serial","H","Intermittent serial drops","Check termination, bias, shield grounding and cable routing near power cables before changing configuration.","",""],
    ["Troubleshooting","M","Device Restart IIN will not clear","Master must write g80 v1 index 7 to 0. If it returns, the RTU is resetting; check power and watchdog.","",""],
    ["Troubleshooting","M","Need Time IIN will not clear","Time write failed or is rejected. Check clock source, format and time-sync permissions.","",""],
    ["Troubleshooting","H","Event Buffer Overflow","Reduce deadbands, shorten event poll intervals or enlarge buffers, then run an integrity poll to resync.","",""],
    ["Troubleshooting","M","Object Unknown","The RTU does not support the requested group or variation. Request a supported variation or Class 0.","",""],
    ["Troubleshooting","M","Parameter Error","The qualifier or range is invalid. Check start/stop indexes against the point list.","",""],
    ["Troubleshooting","C","Duplicate master addresses","Two masters with the same address cause mixed responses and duplicate controls. Give each master a unique address.","",""],
    ["Troubleshooting","H","Diagnose timestamp drift","Compare RTU, master and GPS clock. Check time zone and UTC handling before suspecting the network.","",""],
    ["Troubleshooting,Serial","H","Measure ground potential differences","Measure AC and DC between the two earth points. More than a few volts causes RS-485 errors; use isolation or fibre.","",""],
    ["Troubleshooting","M","Rising CRC errors","Suspect EMI, loose terminals, damaged shields or poor earthing; check connectors during peak load.","",""],
    ["Troubleshooting,Ethernet","M","TCP sessions flap","Keepalive longer than firewall idle timeout drops sessions. Lower keepalive and check switch logs.","",""],

    // ---------- Commissioning ----------
    ["Troubleshooting","H","Run a power-cycle test","Power-cycle the RTU and confirm Device Restart, null unsolicited, integrity poll and normal data return.","",""],
    ["Troubleshooting,DEWA","H","Do point-to-point testing for every point","Force each input and output at source and verify master tag, polarity, scaling and timestamp with the utility witness.","",""],
    ["Troubleshooting","M","Test communications failover","Pull the primary link and confirm switchover time and alarm generation.","",""],
    ["Troubleshooting","M","Record as-built communication settings","Record IPs, addresses, baud, timeouts and firmware revisions in the SAT report.","",""],
    ["Troubleshooting","M","Back up the configuration before leaving site","Save RTU config and master database with date and checksum.","",""]
  ];

  var TIPS = RAW.map(function (r, i) {
    var tags = r[0].split(',');
    return { id: i + 1, cat: tags[0], tags: tags, sev: r[1], title: r[2], body: r[3], field: r[4], cmd: r[5] };
  });

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function hex2(n) { return (n < 16 ? '0' : '') + n.toString(16).toUpperCase(); }
  function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage unavailable */ } }
  function load(key, def) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  }
  function debounce(fn, ms) {
    var t;
    return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); };
  }

  // ---------- state ----------
  var state = {
    q: '', tag: 'all', sort: 'default',
    bookmarks: load('dnp3uae.bookmarks', []),
    checklist: load('dnp3uae.checklist', [])
  };

  // ---------- toast ----------
  var toastTimer;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); t.hidden = true; }, 3200);
  }

  function copyText(text, okMsg) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast(okMsg || 'Copied'); } catch (e) { toast('Copy failed'); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(okMsg || 'Copied'); }, fallback);
    } else { fallback(); }
  }

  // ---------- filtering and rendering ----------
  function matches(t) {
    if (state.tag === 'bookmarks' && state.bookmarks.indexOf(t.id) < 0) return false;
    if (state.tag !== 'all' && state.tag !== 'bookmarks' && t.tags.indexOf(state.tag) < 0) return false;
    if (state.q) {
      var hay = (t.title + ' ' + t.body + ' ' + t.field + ' ' + t.cmd + ' ' + t.tags.join(' ')).toLowerCase();
      var words = state.q.toLowerCase().split(/\s+/);
      for (var i = 0; i < words.length; i++) { if (words[i] && hay.indexOf(words[i]) < 0) return false; }
    }
    return true;
  }

  function render() {
    var list = TIPS.filter(matches);
    if (state.sort === 'severity') list.sort(function (a, b) { return SEV_RANK[a.sev] - SEV_RANK[b.sev] || a.id - b.id; });
    if (state.sort === 'title') list.sort(function (a, b) { return a.title.localeCompare(b.title); });

    var html = list.map(function (t) {
      var saved = state.bookmarks.indexOf(t.id) >= 0;
      return '<article class="card sev-' + t.sev + '" data-id="' + t.id + '" tabindex="0" role="button" aria-label="Open tip: ' + esc(t.title) + '">' +
        '<div class="card-top"><span class="sev">' + SEV[t.sev] + '</span>' +
        '<button type="button" class="bm' + (saved ? ' is-saved' : '') + '" data-bm="' + t.id + '" aria-pressed="' + saved + '" aria-label="' + (saved ? 'Remove bookmark' : 'Bookmark tip') + '">' + (saved ? '&#9733;' : '&#9734;') + '</button></div>' +
        '<h3>' + esc(t.title) + '</h3><p>' + esc(t.body) + '</p>' +
        '<div class="tags">' + t.tags.map(function (g) { return '<span class="tag">#' + esc(g) + '</span>'; }).join('') + '</div></article>';
    }).join('');

    $('grid').innerHTML = html;
    $('empty').hidden = list.length > 0;
    $('resultCount').textContent = list.length + ' of ' + TIPS.length + ' tips';
    $('bookmarkCount').textContent = state.bookmarks.length;
    $('checkCount').textContent = state.checklist.length;
  }

  function setTag(tag) {
    state.tag = tag;
    var pills = document.querySelectorAll('#filters .pill');
    for (var i = 0; i < pills.length; i++) pills[i].classList.toggle('is-active', pills[i].getAttribute('data-tag') === tag);
    render();
  }

  function toggleBookmark(id) {
    var i = state.bookmarks.indexOf(id);
    if (i >= 0) { state.bookmarks.splice(i, 1); toast('Bookmark removed'); }
    else { state.bookmarks.push(id); toast('Tip saved'); }
    store('dnp3uae.bookmarks', state.bookmarks);
    render();
  }

  // ---------- modal ----------
  var modalFocus = null;
  function findTip(id) { for (var i = 0; i < TIPS.length; i++) if (TIPS[i].id === id) return TIPS[i]; return null; }

  function openModal(id) {
    var t = findTip(id);
    if (!t) return;
    var saved = state.bookmarks.indexOf(id) >= 0;
    var inList = state.checklist.some(function (c) { return c.id === id; });
    modalFocus = document.activeElement;
    $('modalBody').innerHTML =
      '<span class="sev sev-chip-' + t.sev + '">' + SEV[t.sev] + ' priority</span>' +
      '<h2 id="modalTitle">' + esc(t.title) + '</h2>' +
      '<p class="modal-text">' + esc(t.body) + '</p>' +
      (t.field ? '<div class="field-note"><strong>UAE field note</strong><p>' + esc(t.field) + '</p></div>' : '') +
      (t.cmd ? '<div class="snippet"><pre class="mono">' + esc(t.cmd) + '</pre><button type="button" class="btn" data-copy="' + esc(t.cmd) + '">Copy hex</button></div>' : '') +
      '<div class="tags">' + t.tags.map(function (g) { return '<span class="tag">#' + esc(g) + '</span>'; }).join('') + '</div>' +
      '<div class="btn-row"><button type="button" class="btn btn-accent" data-m-check="' + id + '">' + (inList ? 'Remove from checklist' : 'Add to checklist') + '</button>' +
      '<button type="button" class="btn" data-m-bm="' + id + '">' + (saved ? 'Remove bookmark' : 'Bookmark') + '</button></div>';
    $('modal').hidden = false;
    document.body.classList.add('no-scroll');
    var c = $('modal').querySelector('.modal-close'); if (c) c.focus();
  }

  function closeModal() {
    $('modal').hidden = true;
    document.body.classList.remove('no-scroll');
    if (modalFocus && modalFocus.focus) modalFocus.focus();
  }

  // ---------- checklist ----------
  function toggleChecklist(id) {
    var idx = -1;
    state.checklist.forEach(function (c, i) { if (c.id === id) idx = i; });
    if (idx >= 0) { state.checklist.splice(idx, 1); toast('Removed from checklist'); }
    else { state.checklist.push({ id: id, done: false }); toast('Added to checklist'); }
    store('dnp3uae.checklist', state.checklist);
    renderChecklist(); render();
  }

  function renderChecklist() {
    var ul = $('checklistItems');
    if (!state.checklist.length) { ul.innerHTML = '<li class="check-empty">No steps yet. Open a tip and choose Add to checklist.</li>'; return; }
    ul.innerHTML = state.checklist.map(function (c) {
      var t = findTip(c.id); if (!t) return '';
      return '<li class="check-item' + (c.done ? ' is-done' : '') + '"><label><input type="checkbox" data-check="' + c.id + '"' + (c.done ? ' checked' : '') + '> <span>' + esc(t.title) + '</span></label>' +
        '<button type="button" class="link" data-open="' + c.id + '">Details</button></li>';
    }).join('');
  }

  function openDrawer() { renderChecklist(); $('checklist').hidden = false; document.body.classList.add('no-scroll'); }
  function closeDrawer() { $('checklist').hidden = true; document.body.classList.remove('no-scroll'); }

  // ---------- IIN decoder ----------
  var IIN1 = ['All stations (broadcast) received', 'Class 1 events available', 'Class 2 events available', 'Class 3 events available', 'Need Time (time sync required)', 'Local Control (outputs in local)', 'Device Trouble (hardware fault)', 'Device Restart'];
  var IIN2 = ['No function code support', 'Object Unknown (point/variation not supported)', 'Parameter Error (bad qualifier or range)', 'Event Buffer Overflow', 'Already Executing (operation in progress)', 'Configuration Corrupt', 'Reserved (bit 6)', 'Reserved (bit 7)'];
  var IIN_BAD = { '1:6': 1, '1:7': 1, '2:0': 1, '2:1': 1, '2:2': 1, '2:3': 1, '2:5': 1 };

  function parseByte(s) {
    s = String(s).trim().replace(/^0x/i, '');
    if (!/^[0-9a-f]{1,2}$/i.test(s)) return null;
    return parseInt(s, 16);
  }

  function iinList(b1, b2) {
    var out = [];
    for (var i = 0; i < 8; i++) if (b1 & (1 << i)) out.push({ k: '1:' + i, text: 'IIN1.' + i + ' ' + IIN1[i] });
    for (var j = 0; j < 8; j++) if (b2 & (1 << j)) out.push({ k: '2:' + j, text: 'IIN2.' + j + ' ' + IIN2[j] });
    return out;
  }

  function decodeIIN() {
    var raw1 = $('iin1').value.trim(), raw2 = $('iin2').value.trim();
    var out = $('iinOut');
    // allow "80 00" or "0x80 0x00" typed in the first box
    if (raw1 && !raw2 && /\s|,/.test(raw1)) {
      var parts = raw1.split(/[\s,]+/);
      raw1 = parts[0]; raw2 = parts[1] || '00';
    }
    if (!raw1 && !raw2) { out.innerHTML = ''; return; }
    var b1 = parseByte(raw1 || '0'), b2 = parseByte(raw2 || '0');
    if (b1 === null || b2 === null) { out.innerHTML = '<li class="flag bad">Enter one or two hex digits per byte, for example 80 and 00.</li>'; return; }
    var flags = iinList(b1, b2);
    if (!flags.length) { out.innerHTML = '<li class="flag ok">IIN 0x' + hex2(b1) + ' 0x' + hex2(b2) + ': no indications set</li>'; return; }
    out.innerHTML = flags.map(function (f) {
      return '<li class="flag ' + (IIN_BAD[f.k] ? 'bad' : 'warn') + '">' + esc(f.text) + '</li>';
    }).join('');
  }

  // ---------- DNP3 frame helpers ----------
  function crc16(bytes) {
    var c = 0;
    for (var i = 0; i < bytes.length; i++) {
      c ^= bytes[i];
      for (var k = 0; k < 8; k++) c = (c & 1) ? ((c >>> 1) ^ 0xA6BC) : (c >>> 1);
    }
    return (~c) & 0xFFFF;
  }

  function buildFrame(ctrl, dst, src, user) {
    var head = [0x05, 0x64, 5 + user.length, ctrl, dst & 255, dst >> 8, src & 255, src >> 8];
    var out = head.slice(), c = crc16(head);
    out.push(c & 255, c >> 8);
    for (var i = 0; i < user.length; i += 16) {
      var blk = user.slice(i, i + 16), bc = crc16(blk);
      out = out.concat(blk, [bc & 255, bc >> 8]);
    }
    return out;
  }

  var LINK_PRI = { 0: 'Reset link states', 2: 'Test link states', 3: 'Confirmed user data', 4: 'Unconfirmed user data', 9: 'Request link status' };
  var LINK_SEC = { 0: 'ACK', 1: 'NACK', 11: 'Link status', 15: 'Link not supported' };
  var APP_FC = { 0: 'Confirm', 1: 'Read', 2: 'Write', 3: 'Select', 4: 'Operate', 5: 'Direct Operate', 6: 'Direct Operate (no ack)', 7: 'Immediate Freeze', 13: 'Cold Restart', 14: 'Warm Restart', 20: 'Enable Unsolicited', 21: 'Disable Unsolicited', 23: 'Delay Measurement', 129: 'Response', 130: 'Unsolicited Response' };
  var GROUPS = { 1: 'Binary input', 2: 'Binary input event', 10: 'Binary output', 12: 'Control relay output block', 20: 'Counter', 21: 'Frozen counter', 22: 'Counter event', 30: 'Analog input', 32: 'Analog input event', 40: 'Analog output status', 41: 'Analog output block', 50: 'Time and date', 51: 'Time and date CTO', 52: 'Time delay', 60: 'Class data', 80: 'Internal indications', 120: 'Authentication' };
  var CLASS_VAR = { 1: 'Class 0', 2: 'Class 1', 3: 'Class 2', 4: 'Class 3' };

  function parseHex(text) {
    var s = text.replace(/0x/gi, ' ').replace(/[^0-9a-f]/gi, '');
    if (!s.length || s.length % 2) return null;
    var b = [];
    for (var i = 0; i < s.length; i += 2) b.push(parseInt(s.substr(i, 2), 16));
    return b;
  }

  function row(field, hx, meaning, cls) {
    return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + esc(field) + '</td><td class="mono">' + esc(hx) + '</td><td>' + esc(meaning) + '</td></tr>';
  }

  function inspectFrame() {
    var out = $('hexOut');
    var b = parseHex($('hexInput').value);
    if (!b) { out.innerHTML = '<p class="flag bad">Enter complete hex bytes, for example 05 64 14 C4 0A 00 01 00 ...</p>'; return; }
    var s = -1;
    for (var i = 0; i < b.length - 1; i++) if (b[i] === 0x05 && b[i + 1] === 0x64) { s = i; break; }
    if (s < 0) { out.innerHTML = '<p class="flag bad">No 05 64 start bytes found. Check baud rate and protocol selection.</p>'; return; }
    b = b.slice(s);
    if (b.length < 10) { out.innerHTML = '<p class="flag bad">Frame too short: a data link header is 10 bytes including CRC.</p>'; return; }

    var rows = [];
    rows.push(row('Start', hex2(b[0]) + ' ' + hex2(b[1]), 'Data link start bytes'));
    var len = b[2];
    rows.push(row('Length', hex2(len), len + ' (5 header bytes + ' + Math.max(len - 5, 0) + ' user data bytes, CRCs excluded)'));
    var ctl = b[3], dir = (ctl >> 7) & 1, prm = (ctl >> 6) & 1, fn = ctl & 15;
    var fnName = (prm ? LINK_PRI : LINK_SEC)[fn] || 'Unknown';
    rows.push(row('Link control', hex2(ctl), (dir ? 'From master' : 'From outstation') + ', ' + (prm ? 'primary' : 'secondary') + ', function ' + fn + ' ' + fnName));
    var dst = b[4] | (b[5] << 8), src = b[6] | (b[7] << 8);
    rows.push(row('Destination', hex2(b[4]) + ' ' + hex2(b[5]), String(dst) + (dst >= 0xFFF0 ? ' (reserved or broadcast)' : '')));
    rows.push(row('Source', hex2(b[6]) + ' ' + hex2(b[7]), String(src) + (src >= 0xFFF0 ? ' (reserved)' : '')));
    var hc = crc16(b.slice(0, 8)), hv = b[8] | (b[9] << 8);
    rows.push(row('Header CRC', hex2(b[8]) + ' ' + hex2(b[9]), hc === hv ? 'OK' : 'MISMATCH (expected ' + hex2(hc & 255) + ' ' + hex2(hc >> 8) + ')', hc === hv ? 'ok' : 'bad'));

    // data blocks
    var need = Math.max(len - 5, 0), pos = 10, user = [], blockBad = 0, truncated = false;
    while (need > 0) {
      var n = Math.min(16, need);
      if (pos + n + 2 > b.length) { truncated = true; user = user.concat(b.slice(pos, Math.max(pos, b.length - 2))); break; }
      var blk = b.slice(pos, pos + n), cv = b[pos + n] | (b[pos + n + 1] << 8);
      if (crc16(blk) !== cv) blockBad++;
      user = user.concat(blk); pos += n + 2; need -= n;
    }
    rows.push(row('Data CRCs', '', truncated ? 'Frame truncated: fewer bytes than the length field states' : (blockBad ? blockBad + ' data block CRC failure(s)' : 'All data block CRCs OK'), (truncated || blockBad) ? 'bad' : 'ok'));

    if (user.length >= 1) {
      var tp = user[0];
      rows.push(row('Transport', hex2(tp), 'FIR=' + ((tp >> 7) & 1) + ' FIN=' + ((tp >> 6) & 1) + ' SEQ=' + (tp & 63)));
    }
    if (user.length >= 3) {
      var ac = user[1], af = user[2];
      rows.push(row('App control', hex2(ac), 'FIR=' + ((ac >> 7) & 1) + ' FIN=' + ((ac >> 6) & 1) + ' CON=' + ((ac >> 5) & 1) + ' UNS=' + ((ac >> 4) & 1) + ' SEQ=' + (ac & 15)));
      rows.push(row('Function', hex2(af), (APP_FC[af] || 'Unknown') + ' (0x' + hex2(af) + ')'));
      var p = 3;
      if ((af === 129 || af === 130) && user.length >= 5) {
        rows.push(row('IIN', hex2(user[3]) + ' ' + hex2(user[4]), (iinList(user[3], user[4]).map(function (f) { return f.text; }).join('; ')) || 'No indications set'));
        p = 5;
      }
      while (p + 3 <= user.length) {
        var g = user[p], v = user[p + 1], q = user[p + 2];
        var name = g === 60 ? (CLASS_VAR[v] || 'Class data') : ((GROUPS[g] || 'Group ' + g) + ' variation ' + v);
        rows.push(row('Object', hex2(g) + ' ' + hex2(v) + ' ' + hex2(q), 'g' + g + 'v' + v + ' ' + name + ', qualifier 0x' + hex2(q)));
        break;
      }
    }
    out.innerHTML = '<div class="table-wrap"><table class="hex-table"><thead><tr><th>Field</th><th>Hex</th><th>Meaning</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }

  function loadSample() {
    var user = [0xC0, 0xC0, 0x01, 0x3C, 0x02, 0x06, 0x3C, 0x03, 0x06, 0x3C, 0x04, 0x06, 0x3C, 0x01, 0x06];
    $('hexInput').value = buildFrame(0xC4, 10, 1, user).map(hex2).join(' ');
    inspectFrame();
  }

  // ---------- network + install ----------
  var deferredPrompt = null;
  function setNet(online, silent) {
    var el = $('netStatus');
    el.className = 'badge ' + (online ? 'badge-online' : 'badge-offline');
    el.querySelector('span').textContent = online ? 'Online' : 'Offline';
    if (!silent) toast(online ? 'Back online' : 'Offline mode: all tips remain available');
  }

  function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }

  // ---------- init ----------
  function init() {
    render();
    renderChecklist();
    setNet(navigator.onLine, true);

    $('search').addEventListener('input', debounce(function (e) { state.q = e.target.value.trim(); render(); }, 180));
    $('sortSelect').addEventListener('change', function (e) { state.sort = e.target.value; render(); });
    $('filters').addEventListener('click', function (e) {
      var b = e.target.closest('.pill'); if (b) setTag(b.getAttribute('data-tag'));
    });
    $('resetFilters').addEventListener('click', function () { $('search').value = ''; state.q = ''; setTag('all'); });

    $('grid').addEventListener('click', function (e) {
      var bm = e.target.closest('[data-bm]');
      if (bm) { e.stopPropagation(); toggleBookmark(parseInt(bm.getAttribute('data-bm'), 10)); return; }
      var card = e.target.closest('.card');
      if (card) openModal(parseInt(card.getAttribute('data-id'), 10));
    });
    $('grid').addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('card')) {
        e.preventDefault(); openModal(parseInt(e.target.getAttribute('data-id'), 10));
      }
    });

    $('modal').addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { closeModal(); return; }
      var cp = e.target.closest('[data-copy]');
      if (cp) { copyText(cp.getAttribute('data-copy'), 'Hex copied'); return; }
      var ck = e.target.closest('[data-m-check]');
      if (ck) { var id = parseInt(ck.getAttribute('data-m-check'), 10); toggleChecklist(id); openModal(id); return; }
      var mb = e.target.closest('[data-m-bm]');
      if (mb) { var id2 = parseInt(mb.getAttribute('data-m-bm'), 10); toggleBookmark(id2); openModal(id2); }
    });

    $('checklistBtn').addEventListener('click', openDrawer);
    $('checklist').addEventListener('click', function (e) {
      if (e.target.closest('[data-close-drawer]')) { closeDrawer(); return; }
      var op = e.target.closest('[data-open]');
      if (op) { closeDrawer(); openModal(parseInt(op.getAttribute('data-open'), 10)); }
    });
    $('checklistItems').addEventListener('change', function (e) {
      var cb = e.target.closest('[data-check]'); if (!cb) return;
      var id = parseInt(cb.getAttribute('data-check'), 10);
      state.checklist.forEach(function (c) { if (c.id === id) c.done = cb.checked; });
      store('dnp3uae.checklist', state.checklist); renderChecklist();
    });
    $('checklistCopy').addEventListener('click', function () {
      if (!state.checklist.length) { toast('Checklist is empty'); return; }
      var txt = 'DNP3 UAE field checklist\n' + state.checklist.map(function (c) {
        var t = findTip(c.id); return (c.done ? '[x] ' : '[ ] ') + (t ? t.title : '');
      }).join('\n');
      copyText(txt, 'Checklist copied');
    });
    $('checklistReset').addEventListener('click', function () {
      state.checklist = []; store('dnp3uae.checklist', state.checklist); renderChecklist(); render(); toast('Checklist cleared');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if (!$('modal').hidden) closeModal(); if (!$('checklist').hidden) closeDrawer(); }
    });

    $('iin1').addEventListener('input', decodeIIN);
    $('iin2').addEventListener('input', decodeIIN);
    $('hexDecode').addEventListener('click', inspectFrame);
    $('hexSample').addEventListener('click', loadSample);
    $('hexClear').addEventListener('click', function () { $('hexInput').value = ''; $('hexOut').innerHTML = ''; });

    window.addEventListener('online', function () { setNet(true); });
    window.addEventListener('offline', function () { setNet(false); });

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); deferredPrompt = e; $('installBtn').hidden = false;
    });
    window.addEventListener('appinstalled', function () {
      deferredPrompt = null; $('installBtn').hidden = true; toast('App installed');
    });
    if (isIOS() && !isStandalone()) $('installBtn').hidden = false;
    $('installBtn').addEventListener('click', function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () { deferredPrompt = null; $('installBtn').hidden = true; });
      } else if (isIOS()) {
        toast('In Safari tap Share, then Add to Home Screen');
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
