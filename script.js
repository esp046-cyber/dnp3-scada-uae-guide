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

  // ---------- commissioning stages ----------
  var STAGES = [
    { n: 1, short: 'Physical & heat', title: 'Stage 1: RS-485 / Fibre Physical Layer and Desert Heat Derating', desc: 'Cable, termination, grounding, fibre and kiosk temperature. Fix these first; nothing above them is reliable until they are right.' },
    { n: 2, short: 'Addressing & link', title: 'Stage 2: Addressing, Handshakes and Link Setup', desc: 'Link addresses, restart and time handshakes, and getting the first clean response.' },
    { n: 3, short: 'Polling & deadband', title: 'Stage 3: Class Polling and Deadband Optimisation', desc: 'Scan rates, event classes, unsolicited reporting, analogue variations and deadbands.' },
    { n: 4, short: 'SBO & breakers', title: 'Stage 4: SBO Control Relays and Breaker Tripping', desc: 'Select-before-operate sequencing, CROB codes, pulse timing and local/remote interlocks.' },
    { n: 5, short: 'Hex diagnostics', title: 'Stage 5: Live Hex Trace Diagnostics (Wireshark / Port Sniffer)', desc: 'Capturing traffic, reading headers, CRCs, IIN bits and spotting truncated or duplicated frames.' }
  ];

  // k: 'hex' builds a valid frame with correct CRCs at runtime ([ctrl, dst, src, userBytes], m = 'badcrc' | 'trunc');
  //    k: 'iin' fills the IIN decoder. All addresses: master 1, outstation 10.
  var SCEN = [
    { s: 1, sev: 'C', tags: ['Serial', 'Troubleshooting', 'HexAnalysis'],
      t: 'Long RS-485 run shows CRC failures and random drops',
      site: '11 kV ring main unit at Jebel Ali, 800 m of twisted pair to the control building, 9600 baud 8N1, RTU in a sealed kiosk.',
      sym: 'Link works for minutes, then polls time out. The sniffer shows frames starting 05 64 but data-block CRCs failing. Worse when nearby pumps start.',
      ex: [{ l: 'Class 0 request with a corrupted data byte (data-block CRC fails)', k: 'hex', f: [0xC4, 10, 1, [0xC0, 0xC0, 0x01, 0x3C, 0x01, 0x06]], m: 'badcrc', n: 'The header CRC is fine, the data CRC is not: noise corrupted the payload, so check wiring before software.' }],
      params: ['Termination: 120 ohm at the two physical ends only', 'Bias: 1 pair of 560 ohm resistors at the master side only (check device manual)', 'Cable: shielded twisted pair, shield earthed at one end', 'Serial: 9600 8N1 on every node'],
      fix: ['Power off the bus and measure about 60 ohm between A and B (two 120 ohm in parallel).', 'Remove any 120 ohm resistor fitted on middle drops.', 'Check idle differential is 200 mV or more with a multimeter or scope.', 'Separate the comms cable from motor and power cables by 30 cm or more.', 'If errors persist, replace the run with fibre or fit isolated converters.'] },

    { s: 1, sev: 'C', tags: ['Environment', 'DEWA', 'Troubleshooting'],
      t: 'RTU restarts every afternoon in a sun-baked kiosk',
      site: 'Outdoor RMR kiosk in Dubai in July, +50 C ambient, direct sun on the roof, no sunshield, 24 V DC PSU and battery inside.',
      sym: 'Communication drops 14:00-17:00 then returns. Master shows Device Restart (IIN1.7) after each drop. Logs show restarts only in the hottest hours.',
      ex: [{ l: 'IIN after the restart', k: 'iin', v: '80 00', n: 'IIN1.7 Device Restart: the RTU rebooted. Repeats mean power or thermal stress, not a protocol fault.' }],
      params: ['Kiosk internal temperature point: g30v1 (analogue input), alarm at 60 C', 'Deadband 2 percent', 'PSU: check datasheet derating above 50-60 C', 'Battery: temperature-compensated charging'],
      fix: ['Log the internal temperature with a data logger or an analogue point for 48 hours.', 'Compare against the RTU and PSU rated temperature and derating curve.', 'Fit a sunshield or double-skin roof and light-coloured paint.', 'Replace PSU or RTU with a wide-temperature type if the margin is negative.', 'After the fix, write g80 v1 index 7 to 0 to clear Device Restart and watch for recurrence.'] },

    { s: 1, sev: 'H', tags: ['Environment', 'DEWA', 'Serial'],
      t: 'Salt air corrodes terminals at a creek-side kiosk',
      site: 'Kiosk near Dubai Creek (Deira), standard IP54 enclosure, uncoated boards, brass glands, high humidity every night.',
      sym: 'Terminals turn green, contact resistance rises, comms becomes intermittent. RTU reports hardware trouble.',
      ex: [{ l: 'Device Trouble indication', k: 'iin', v: '40 00', n: 'IIN1.6 Device Trouble: the RTU is reporting an internal fault. Read vendor diagnostics next.' }],
      params: ['Enclosure: IP66 / NEMA 4X', 'Fixings and glands: 316L stainless', 'PCB: conformal coat to IPC-CC-830', 'Heater with thermostat to stop condensation'],
      fix: ['Replace the enclosure with an IP66 or NEMA 4X unit with stainless hardware.', 'Clean corroded terminals and fit ferrules.', 'Apply conformal coating to the PCBs, masking connectors and heat sinks.', 'Add a thermostat heater and breather to stop night-time condensation.', 'Inspect every 6 months and log the findings.'] },

    { s: 1, sev: 'H', tags: ['Serial', 'Troubleshooting', 'DEWA'],
      t: 'Ground potential difference between switchyard and control room',
      site: '132/11 kV substation. RTU in the switchyard marshalling kiosk, master in the control room, RS-485 cable earthed at both ends.',
      sym: 'CRC failures appear in bursts during switching operations and fault events. Quiet otherwise.',
      ex: [{ l: 'Burst error: payload CRC fails, header intact', k: 'hex', f: [0x44, 1, 10, [0xC0, 0xC0, 0x81, 0x00, 0x00]], m: 'badcrc', n: 'An outstation response whose data block fails CRC during a switching burst.' }],
      params: ['Measure AC and DC volts between the two earth points', 'Shield earthed at one end only', 'Fibre or isolated RS-485 between buildings', 'Surge protection on signal pairs'],
      fix: ['Measure voltage between the two earth bars during normal load and a switching event.', 'Lift the shield at one end.', 'Fit fibre transceivers or galvanically isolated repeaters between buildings.', 'Fit signal surge arresters and bond them to the local earth.', 'Re-test during the next switching operation.'] },

    { s: 2, sev: 'C', tags: ['Protocol', 'Troubleshooting', 'HexAnalysis'],
      t: 'No response: master and RTU link addresses disagree',
      site: 'First energisation of a new 11 kV RTU. Master configured as address 1, RTU as 10. Vendor sheet lists addresses in hex.',
      sym: 'The master sends polls and the RTU stays silent. The sniffer shows the request but no reply. Sometimes the RTU address was typed as 0A in a decimal field.',
      ex: [{ l: 'Correct integrity request, master 1 to outstation 10', k: 'hex', f: [0xC4, 10, 1, [0xC0, 0xC0, 0x01, 0x3C, 0x01, 0x06]], n: 'Destination 0A 00 and source 01 00 are little-endian: 10 and 1.' }, { l: 'Same request with swapped addresses', k: 'hex', f: [0xC4, 1, 10, [0xC0, 0xC0, 0x01, 0x3C, 0x01, 0x06]], n: 'Destination is 1: the RTU ignores it because it is not its own address.' }],
      params: ['Master link address: 1 (decimal)', 'Outstation link address: 10 (decimal, 0A 00 on the wire)', 'Never use 65520-65535 (reserved)', 'Self-address / unconfirmed link: disabled unless specified'],
      fix: ['Write down master and RTU addresses in decimal on the point list.', 'Decode the destination bytes in the sniffer as little-endian.', 'Check the RTU accepts the master source address if address filtering is on.', 'Retry with a known-good request and confirm the RTU replies.'] },

    { s: 2, sev: 'C', tags: ['Protocol', 'Troubleshooting', 'Ethernet'],
      t: 'Duplicate master address causes ghost responses',
      site: 'Backup SCADA front-end brought online at a district cooling plant with the same DNP3 source address as the primary.',
      sym: 'RTU replies reach both masters. Operators see duplicate events and occasional repeated commands.',
      ex: [{ l: 'RTU response addressed to master 1', k: 'hex', f: [0x44, 1, 10, [0xC0, 0xC0, 0x81, 0x00, 0x00]], n: 'Both masters answer to source address 1, so each can consume the other\'s response.' }],
      params: ['Primary master address: 1', 'Backup master address: 2', 'RTU: accept both, unsolicited destination = primary'],
      fix: ['List every master and its DNP3 source address.', 'Assign each master a unique address.', 'Configure the RTU to accept both and to send unsolicited reports to one master.', 'Confirm with a capture that each response goes to a single master.'] },

    { s: 2, sev: 'M', tags: ['Protocol', 'Troubleshooting', 'HexAnalysis'],
      t: 'Device Restart indication will not clear',
      site: 'RTU power-cycled during SAT. Master connects and every response carries Device Restart.',
      sym: 'IIN1.7 is set in every response. The master never clears it, so some masters keep re-initialising.',
      ex: [{ l: 'Response with Device Restart set', k: 'hex', f: [0x44, 1, 10, [0xC0, 0xC0, 0x81, 0x80, 0x00]], n: 'IIN1 = 80 means Device Restart.' }, { l: 'Master write that clears it (g80 v1 index 7 = 0)', k: 'hex', f: [0xC4, 10, 1, [0xC0, 0xC1, 0x02, 0x50, 0x01, 0x00, 0x07, 0x07, 0x00]], n: 'Function 0x02 Write, object 80 var 1, range 7 to 7, value 0.' }],
      params: ['Master: clear Device Restart after the startup integrity poll', 'RTU: DEVICE_RESTART flag auto-clear = off'],
      fix: ['Complete the startup integrity poll first.', 'Send the g80 v1 write to index 7 with value 0.', 'Confirm the next response no longer shows IIN1.7.', 'If it returns, investigate power or watchdog resets on the RTU.'] },

    { s: 2, sev: 'H', tags: ['Protocol', 'DEWA'],
      t: 'Need Time stays set because time was sent in local time',
      site: 'Master sends time every 30 minutes. Event timestamps in the historian are 4 hours out.',
      sym: 'IIN1.4 (Need Time) keeps returning. Events carry the wrong hour.',
      ex: [{ l: 'IIN with Need Time set', k: 'iin', v: '10 00', n: 'IIN1.4 Need Time: the RTU wants a time write.' }],
      params: ['Time source: UTC (the UAE is UTC+4, no daylight saving)', 'Time sync: on Need Time and every 30 minutes', 'Delay Measurement (FC 0x17): on for radio or 9600 baud links'],
      fix: ['Configure the master to send UTC, not GST.', 'Enable Delay Measurement on slow links.', 'Prefer NTP or GPS at the RTU where available.', 'Check the next events against a reference clock.'] },

    { s: 3, sev: 'C', tags: ['Protocol', 'Serial', 'Troubleshooting'],
      t: 'Link drops under Class 0 flooding',
      site: '11 kV RMR kiosk in Jebel Ali on a 9600 baud serial modem, 500-point RTU.',
      sym: 'Class 0 polled every 2 seconds. The serial queue fills, the RTU drops requests, and event buffer overflow appears (IIN2.3, not IIN1.3).',
      ex: [{ l: 'Class 0 request (the flooding poll)', k: 'hex', f: [0xC4, 10, 1, [0xC0, 0xC0, 0x01, 0x3C, 0x01, 0x06]], n: 'Function 0x01 Read, group 60 var 1 qualifier 06 = all Class 0 data.' }, { l: 'Class 1/2/3 event poll (the replacement)', k: 'hex', f: [0xC4, 10, 1, [0xC0, 0xC1, 0x01, 0x3C, 0x02, 0x06, 0x3C, 0x03, 0x06, 0x3C, 0x04, 0x06]], n: 'Groups 60 var 2, 3, 4: the three event classes.' }, { l: 'Response flagging Event Buffer Overflow', k: 'iin', v: '00 08', n: 'IIN2.3 Event Buffer Overflow.' }],
      params: ['Class 0 scan: 900 s', 'Class 1 / 2 / 3 event scan: 2 s', 'Response timeout: 5 s', 'Serial: 9600 8N1'],
      fix: ['Set the Class 0 integrity poll to 900 s.', 'Poll Class 1, 2 and 3 events every 2 s.', 'Raise analogue deadbands so fewer events are created.', 'Check the response time of a Class 0 poll on a capture; keep the scan interval above it.', 'Run one Class 0 poll after changes to resync.'] },

    { s: 3, sev: 'H', tags: ['Protocol', 'Troubleshooting'],
      t: 'Event buffer overflow after a storm of analogue changes',
      site: 'Feeder RTU with noisy CT inputs, analogue deadband left at 0 on 40 MW and kV points.',
      sym: 'During a fault, thousands of analogue events queue. IIN2.3 appears and the master loses event order.',
      ex: [{ l: 'Overflow indication', k: 'iin', v: '00 08', n: 'IIN2.3 Event Buffer Overflow.' }],
      params: ['Deadband MW / MVAr: 1 percent of span', 'Deadband kV: 0.5 percent of span', 'Frequency deadband: 0.02 Hz', 'Event buffer: increase if the RTU allows'],
      fix: ['Read the RTU event buffer size and the configured deadbands.', 'Set deadbands as above.', 'Shorten the event poll interval during faults if the link allows.', 'After the storm, run a Class 0 integrity poll to resync.'] },

    { s: 3, sev: 'H', tags: ['Protocol', 'Serial'],
      t: 'Unsolicited reports collide on a shared RS-485 bus',
      site: 'Four 11 kV RTUs on one half-duplex RS-485 multi-drop line, unsolicited enabled on all.',
      sym: 'During a feeder trip all four RTUs report at once; frames overlap and CRC errors appear. Events are lost.',
      ex: [{ l: 'Enable Unsolicited request for classes 1, 2, 3', k: 'hex', f: [0xC4, 10, 1, [0xC0, 0xC0, 0x14, 0x3C, 0x02, 0x06, 0x3C, 0x03, 0x06, 0x3C, 0x04, 0x06]], n: 'Function 0x14 (20) Enable Unsolicited. Do not send this on a shared half-duplex line.' }],
      params: ['Unsolicited: disabled on shared serial', 'Event poll: 2-5 s round-robin', 'Class 0 integrity: 30-60 min'],
      fix: ['Disable unsolicited on all outstations on the shared bus.', 'Poll each RTU in turn for Class 1, 2, 3 events.', 'Keep a slow integrity poll.', 'Use unsolicited only on dedicated or full-duplex links.'] },

    { s: 3, sev: 'M', tags: ['Protocol', 'HexAnalysis'],
      t: '16-bit analogue overflow shows negative power values',
      site: '132 kV feeder reporting MW scaled by 100; raw values exceed 32767.',
      sym: 'The master shows wrap-around or negative MW when the load rises. The RTU is sending g30 var 2 (16-bit).',
      ex: [{ l: 'Read all g30 var 1 (32-bit with flag)', k: 'hex', f: [0xC4, 10, 1, [0xC0, 0xC0, 0x01, 0x1E, 0x01, 0x06]], n: 'Group 30 (0x1E) variation 1: 32-bit analogue input with flag.' }],
      params: ['Analogue variation: g30v1 (32-bit) or g30v5 (float)', 'Scale: set so raw values stay below 32767 if 16-bit must be used', 'Event variation: g32v3 (32-bit with time)'],
      fix: ['Check the variation the RTU returns for the point.', 'Switch to g30v1 or g30v5 and update the master scaling.', 'Compare master value with the relay HMI at three load levels.', 'Record the scale and variation in the point list.'] },

    { s: 4, sev: 'C', tags: ['Protocol', 'DEWA', 'HexAnalysis'],
      t: 'SBO Operate rejected with status 2 (No Select)',
      site: '11 kV breaker CB-03 at a DEWA substation, master issues Select then Operate over serial.',
      sym: 'Select returns success but Operate returns status 2. The breaker does not move.',
      ex: [{ l: 'Select CROB: close pulse on index 5, app sequence 3', k: 'hex', f: [0xC4, 10, 1, [0xC0, 0xC3, 0x03, 0x0C, 0x01, 0x17, 0x01, 0x05, 0x11, 0x01, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]], n: 'Function 0x03 Select, g12 v1, index 5, control 0x11 (pulse close), count 1, on-time 100 ms.' }, { l: 'Wrong Operate: same sequence 3', k: 'hex', f: [0xC4, 10, 1, [0xC0, 0xC3, 0x04, 0x0C, 0x01, 0x17, 0x01, 0x05, 0x11, 0x01, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]], n: 'Application sequence must be Select + 1. The RTU treats this as unmatched.' }, { l: 'Correct Operate: sequence 4', k: 'hex', f: [0xC4, 10, 1, [0xC0, 0xC4, 0x04, 0x0C, 0x01, 0x17, 0x01, 0x05, 0x11, 0x01, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]], n: 'Function 0x04 Operate with identical objects and sequence 4.' }],
      params: ['Operate sequence: Select sequence + 1', 'Operate objects: identical to Select', 'Select timeout: 10 s', 'Control model: SBO for breakers'],
      fix: ['Capture the Select and Operate and compare the application control bytes.', 'Make sure the Operate repeats index, control code, count and times exactly.', 'Check no other poll was sent between Select and Operate by the same master.', 'Re-test on a spare or isolated breaker.'] },

    { s: 4, sev: 'H', tags: ['Protocol', 'DEWA', 'Troubleshooting'],
      t: 'Breaker command accepted but the breaker does not move',
      site: 'Spring-charged breaker needs a close coil pulse of at least 200 ms. Master uses 100 ms.',
      sym: 'The RTU returns success, the SCADA shows the command executed, the breaker stays open.',
      ex: [{ l: 'Operate with 100 ms on-time', k: 'hex', f: [0xC4, 10, 1, [0xC0, 0xC4, 0x04, 0x0C, 0x01, 0x17, 0x01, 0x05, 0x11, 0x01, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]], n: 'On-time 64 00 00 00 = 100 ms.' }, { l: 'Operate with 300 ms on-time', k: 'hex', f: [0xC4, 10, 1, [0xC0, 0xC4, 0x04, 0x0C, 0x01, 0x17, 0x01, 0x05, 0x11, 0x01, 0x2C, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]], n: 'On-time 2C 01 00 00 = 300 ms.' }],
      params: ['Close pulse on-time: 300 ms', 'Trip pulse on-time: 300 ms', 'Control code: 0x11 close, 0x21 trip', 'Verify with breaker status point change'],
      fix: ['Read the breaker or relay manual for the minimum pulse.', 'Set the on-time in the master or RTU CROB configuration.', 'Test close and trip with the breaker isolated.', 'Confirm the breaker status binary changes within 2 seconds.'] },

    { s: 4, sev: 'H', tags: ['Protocol', 'Troubleshooting', 'DEWA'],
      t: 'Control rejected with status 7: panel is in Local',
      site: 'Remote trip of a ring main unit on a night shift. Local/Remote switch left in Local after maintenance.',
      sym: 'Select or Operate returns status 7 (Local). IIN shows Local Control.',
      ex: [{ l: 'IIN with Local Control set', k: 'iin', v: '20 00', n: 'IIN1.5 Local Control: outputs are under local control.' }],
      params: ['Local/Remote status point: binary input, Class 1', 'Master interlock: block commands when Local'],
      fix: ['Check the Local/Remote switch at the panel and the status point on the master.', 'Return the switch to Remote only after the work permit is closed.', 'Add an interlock in the master so commands are blocked in Local.', 'Retest with a safe command.'] },

    { s: 4, sev: 'M', tags: ['Protocol', 'DEWA'],
      t: 'Operate returns status 1 (Timeout) after operator delay',
      site: 'Operator selects a breaker and waits for a second approval before confirming.',
      sym: 'Operate fails with status 1. The Select was accepted 20 seconds earlier.',
      ex: [{ l: 'Select used before the delay', k: 'hex', f: [0xC4, 10, 1, [0xC0, 0xC3, 0x03, 0x0C, 0x01, 0x17, 0x01, 0x05, 0x21, 0x01, 0x2C, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]], n: 'Select of a pulse trip (0x21). It expires after the select timeout.' }],
      params: ['Select timeout: 10 s', 'Operator confirmation window: less than the select timeout', 'Send Select and Operate back to back'],
      fix: ['Get the RTU select timeout from its manual.', 'Make the master send Select only after final operator approval.', 'Retry; do not raise the timeout above what the utility allows.'] },

    { s: 5, sev: 'H', tags: ['Serial', 'HexAnalysis', 'Troubleshooting'],
      t: 'Capture traffic with a USB RS-485 sniffer',
      site: 'Serial RTU on a multi-drop line in a control room. No port mirroring available.',
      sym: 'You need to see what the master and RTU actually say.',
      ex: [{ l: 'Typical response seen on the wire', k: 'hex', f: [0x44, 1, 10, [0xC0, 0xC0, 0x81, 0x00, 0x00]], n: 'Starts 05 64, control 44 (outstation to master), function 0x81 Response, IIN 00 00.' }],
      params: ['Sniffer: same baud, parity and stop bits as the bus', 'Connect A and B in parallel (high impedance, no termination)', 'Save raw hex to a text file'],
      fix: ['Set the same serial settings as the bus.', 'Clip A and B in parallel without adding termination.', 'Capture a poll and its reply.', 'Paste the hex into the inspector above and check the header, CRC and IIN.'] },

    { s: 5, sev: 'H', tags: ['Ethernet', 'HexAnalysis', 'Cybersecurity'],
      t: 'Wireshark on a mirrored port for TCP port 20000',
      site: 'DNP3 over TCP between SCADA front end and an RTU through a managed switch.',
      sym: 'RTU data is stale but the TCP session shows as up.',
      ex: [{ l: 'Response with Class 1 events and Device Restart', k: 'hex', f: [0x44, 1, 10, [0xC0, 0xC0, 0x81, 0x82, 0x00]], n: 'IIN1 = 82: Device Restart plus Class 1 events available.' }],
      params: ['Display filter: dnp3 or tcp.port == 20000', 'SPAN: mirror the RTU port to the laptop port', 'Check TCP retransmissions and keepalives'],
      fix: ['Mirror the RTU switch port to your laptop.', 'Apply the display filter above.', 'Look for polls without responses, TCP resets and retransmissions.', 'Check IIN bits in each response.'] },

    { s: 5, sev: 'M', tags: ['HexAnalysis', 'Troubleshooting'],
      t: 'Read a response header: where the IIN bytes sit',
      site: 'Debugging a master that keeps polling although events are waiting.',
      sym: 'Class 1 events are flagged but the master does not read them.',
      ex: [{ l: 'Response with Class 1 events available', k: 'hex', f: [0x44, 1, 10, [0xC0, 0xC0, 0x81, 0x02, 0x00]], n: 'After function 0x81 come IIN1 and IIN2. 02 in IIN1 means Class 1 events are available.' }, { l: 'The IIN bytes alone', k: 'iin', v: '02 00', n: 'IIN1.1 Class 1 events available.' }],
      params: ['Event poll: Class 1, 2, 3 every 2-5 s', 'Or trigger an event poll when IIN1.1-1.3 are set'],
      fix: ['Decode the response above.', 'Check the master reacts to IIN1.1-1.3.', 'Add an event poll if it does not.'] },

    { s: 5, sev: 'H', tags: ['HexAnalysis', 'Troubleshooting', 'Serial'],
      t: 'Truncated frame: length byte promises more than arrives',
      site: 'Radio or modem link that drops the tail of long frames.',
      sym: 'Master reports no valid response. The capture shows a frame that ends early.',
      ex: [{ l: 'Frame cut short', k: 'hex', f: [0x44, 1, 10, [0xC0, 0xC0, 0x81, 0x00, 0x00]], m: 'trunc', n: 'The length field says more user data than the capture contains.' }],
      params: ['Modem buffer / flow control: RTS-CTS on', 'Maximum fragment size: match master and RTU', 'Radio turnaround delay: 20-50 ms'],
      fix: ['Check the length byte against the captured bytes.', 'Enable hardware flow control or increase modem buffer.', 'Reduce the maximum fragment size on both sides.', 'Retest with a large Class 0 poll.'] },

    { s: 5, sev: 'M', tags: ['Protocol', 'HexAnalysis'],
      t: 'Duplicate events after a lost application confirm',
      site: 'Class 1 events sent by the RTU; the master confirmation is lost on a noisy link.',
      sym: 'The same breaker events appear twice in the historian.',
      ex: [{ l: 'Application Confirm from the master', k: 'hex', f: [0xC4, 10, 1, [0xC0, 0xC1, 0x00]], n: 'Function 0x00 Confirm. If this is lost, the RTU resends the events.' }],
      params: ['Application confirm timeout: 5 s', 'Link retries: 1-2', 'Master: de-duplicate by timestamp and point'],
      fix: ['Capture the poll, response and confirm.', 'Check the confirm is sent and not corrupted.', 'Fix the physical layer first (stage 1).', 'Enable duplicate suppression in the historian.'] }
  ];
  // ---------- expected-response helpers and extra scenarios ----------
  function REQ(user) { return [0xC4, 10, 1, user]; }
  function RSP(i1, i2, extra) { return [0x44, 1, 10, [0xC0, 0xC0, 0x81, i1, i2].concat(extra || [])]; }
  var CLS0 = [0x01, 0x02, 0x00, 0x00, 0x00, 0x81, 0x1E, 0x01, 0x00, 0x00, 0x00, 0x01, 0xD0, 0x07, 0x00, 0x00];
  function CROBQ(fc, seq, code, lo, hi, st) { return [0xC0, 0xC0 | seq, fc, 0x0C, 0x01, 0x17, 0x01, 0x05, code, 1, lo, hi, 0, 0, 0, 0, 0, 0, st || 0]; }
  function CROBR(seq, code, lo, hi, st) { return [0xC0, 0xC0 | seq, 0x81, 0, 0, 0x0C, 0x01, 0x17, 0x01, 0x05, code, 1, lo, hi, 0, 0, 0, 0, 0, 0, st || 0]; }
  var OK = { l: 'Expected response: clean, no indications', k: 'hex', f: RSP(0, 0), n: 'Control 44 (outstation to master), function 81, IIN 00 00. All CRCs OK.' };
  var OKD = { l: 'Expected Class 0 response with data', k: 'hex', f: RSP(0, 0, CLS0), n: 'g1 v2 point 0 (flag 81 = online, ON) then g30 v1 point 0 (flag 01, value 0x000007D0 = 2000).' };

  var EXTRA = [
    { where: ['RTU configurator, DNP3 outstation settings: data link / outstation address (check decimal vs hex)', 'Master driver, channel or device settings: destination address'], resp: [OKD] },
    { where: ['RTU hardware data sheet: operating temperature and derating table', 'RTU analogue point list: add kiosk temperature'], resp: [OK] },
    { where: ['Enclosure and gland schedule, not a software setting', 'RTU diagnostics page: hardware status'], resp: [OK] },
    { where: ['Earthing drawing: shield bonding points', 'Fibre converter: mode switch / port setup'], resp: [OK] },
    { where: ['RTU configurator, DNP3: outstation address and master address (decimal)', 'Master, per-device: link addresses (decimal)'], resp: [OKD] },
    { where: ['Master front-end: DNP3 channel source address', 'RTU: list of accepted master addresses and unsolicited destination'], resp: [OK] },
    { where: ['Master device settings: clear restart after integrity poll', 'RTU: Device Restart IIN behaviour'], resp: [OK] },
    { where: ['Master time settings: time zone must be UTC', 'RTU: time source (NTP / GPS / DNP3)'], resp: [OK, { l: 'Time Write confirmation (RTU accepts g50 v1)', k: 'hex', f: [0x44, 1, 10, [0xC0, 0xC0, 0x81, 0x00, 0x00]], n: 'After the write, IIN1.4 clears.' }] },
    { where: ['Master scan settings: Class 0 integrity interval', 'Master scan settings: event class interval', 'RTU: event buffer size'], resp: [OKD, { l: 'Expected empty event poll response', k: 'hex', f: RSP(0, 0), n: 'No events pending: no object bytes, IIN 00 00.' }] },
    { where: ['RTU point configuration: analogue deadband per point', 'RTU: event buffer size / overflow behaviour'], resp: [OK] },
    { where: ['RTU: unsolicited response enable per class', 'Master: unsolicited handling and scan list'], resp: [OK] },
    { where: ['RTU point configuration: static and event variation per analogue point', 'Master point table: raw scale and engineering range'], resp: [OKD] },
    { where: ['Master control settings: control model SBO and sequencing', 'RTU: control model per point'], resp: [{ l: 'Expected Select response, status 0', k: 'hex', f: [0x44, 1, 10, CROBR(3, 0x11, 0x64, 0x00, 0)], n: 'The RTU echoes the CROB. The last byte is the status: 00 = Success.' }, { l: 'Expected Operate response, status 0', k: 'hex', f: [0x44, 1, 10, CROBR(4, 0x11, 0x64, 0x00, 0)], n: 'Sequence 4, status 00 Success.' }] },
    { where: ['RTU or relay: minimum close/trip pulse width', 'Master or RTU: CROB on-time per control point'], resp: [{ l: 'Expected Operate response, status 0', k: 'hex', f: [0x44, 1, 10, CROBR(4, 0x11, 0x2C, 0x01, 0)], n: 'On-time 2C 01 = 300 ms echoed, status 00.' }] },
    { where: ['Panel Local/Remote switch', 'Master: interlock using the Local/Remote status point'], resp: [{ l: 'Expected Select response after switching to Remote', k: 'hex', f: [0x44, 1, 10, CROBR(3, 0x11, 0x64, 0x00, 0)], n: 'Status 00 Success.' }] },
    { where: ['Master control settings: select timeout', 'RTU: select timeout'], resp: [{ l: 'Expected Select response, status 0', k: 'hex', f: [0x44, 1, 10, CROBR(3, 0x21, 0x2C, 0x01, 0)], n: 'Status 00 Success.' }] },
    { where: ['Sniffer software: baud, parity and stop bits'], resp: [OK] },
    { where: ['Switch: SPAN / port mirror configuration', 'Wireshark: display filter bar'], resp: [OK] },
    { where: ['Master: event poll triggered by IIN1.1-1.3'], resp: [OK] },
    { where: ['Modem or radio configuration: flow control and buffer', 'RTU and master: maximum fragment size'], resp: [OK] },
    { where: ['Master: application confirm timeout and retries', 'Historian: duplicate suppression'], resp: [OK] }
  ];
  EXTRA.forEach(function (x, i) { SCEN[i].where = x.where; SCEN[i].resp = x.resp; });

  SCEN.push(
    { s: 1, sev: 'H', tags: ['Serial', 'Troubleshooting'], t: 'No bias resistors: idle line floats and the RTU sees garbage',
      site: 'Spare RTU added to an existing RS-485 bus at a SEWA pumping station, no bias at the master.',
      sym: 'Random characters appear when no one is talking. CRC errors in the first frame after silence.',
      ex: [{ l: 'Capture that starts with noise bytes then a valid frame', k: 'raw', v: 'FF E0 00 05 64 05 C0 01 00 00 04 E9 21', n: 'The inspector skips the noise and finds 05 64. In the field this noise is the floating idle line.' }],
      params: ['Bias: 560 ohm pull-up and pull-down at one point only', 'Termination: 120 ohm at both ends', 'Idle differential: 200 mV or more'],
      fix: ['Power off the bus and check there is only one bias point.', 'Add bias at the master or converter.', 'Measure the idle differential with a meter.', 'Re-capture and confirm the first frame after silence is clean.'],
      where: ['Converter or master port: bias / fail-safe switch', 'Terminal block: resistor fitting'], resp: [OK] },
    { s: 1, sev: 'H', tags: ['Serial', 'Troubleshooting', 'HexAnalysis'], t: 'Baud rate or parity mismatch: capture shows no 05 64',
      site: 'RTU swapped during a site visit; new unit ships at 19200 8E1 while the bus is 9600 8N1.',
      sym: 'The sniffer shows bytes but no 05 64 anywhere. Every device on the bus looks dead.',
      ex: [{ l: 'Mis-framed capture (wrong baud shows as garbage)', k: 'raw', v: 'F8 3C 00 FE 78 E0 1F 80 66', n: 'No 05 64 found: check baud, parity and stop bits before anything else.' }],
      params: ['Serial: 9600 8N1 on all nodes (example)', 'Check parity on the sniffer', 'Confirm RTU DIP switches or configurator values'],
      fix: ['Read the serial settings on the RTU and master.', 'Set the sniffer to the same settings.', 'Try 9600, 19200 and 38400 with 8N1 and 8E1 until 05 64 appears.', 'Set all nodes to the same values.'],
      where: ['RTU configurator: serial port settings', 'Master channel: baud, data bits, parity, stop bits'], resp: [OKD] },
    { s: 1, sev: 'M', tags: ['Ethernet', 'Environment', 'Troubleshooting'], t: 'Fibre link dark: Tx and Rx swapped at the patch panel',
      site: 'New fibre pair between a GIS building and the control room, duplex LC patched straight through at both ends.',
      sym: 'Both converters show no link LED. Light is present on both fibres.',
      ex: [],
      params: ['Link LED: on at both ends', 'Optical power: within the SFP receive range', 'SFP wavelength: same at both ends'],
      fix: ['Swap one end of the duplex LC pair.', 'Check the link LED on both converters.', 'Clean connectors and read receive power if the SFP supports it.', 'Confirm the same wavelength and fibre type at both ends.'],
      where: ['Patch panel: LC duplex orientation', 'Switch or converter: DDM / optical power page'], resp: [] },
    { s: 1, sev: 'H', tags: ['Environment', 'Troubleshooting'], t: 'Solar-powered RTU restarts every night',
      site: 'Remote SEWA water-network RTU on a solar panel and battery, dust-covered panel in summer.',
      sym: 'Device Restart every night around 03:00. Battery voltage falls below the RTU threshold.',
      ex: [{ l: 'Response after a night restart', k: 'iin', v: '80 00', n: 'IIN1.7 Device Restart: power dropped out.' }],
      params: ['Battery voltage point: g30 v1, deadband 1 percent', 'Low-voltage alarm: before RTU dropout', 'Panel cleaning interval: monthly in dust season'],
      fix: ['Log battery voltage overnight.', 'Clean the panel and check array current.', 'Check battery capacity and age (heat shortens life).', 'Add a low-voltage alarm so the master warns before dropout.'],
      where: ['RTU analogue point list: battery voltage', 'Charge controller settings'], resp: [OK] },

    { s: 2, sev: 'H', tags: ['Ethernet', 'Cybersecurity', 'Troubleshooting'], t: 'TCP session never opens: firewall blocks port 20000',
      site: 'New RTU behind a utility firewall; master is in the DMZ.',
      sym: 'Ping works, DNP3 does not. The capture shows SYN packets with no SYN-ACK.',
      ex: [],
      params: ['Port: TCP 20000 from master IP to RTU', 'Direction: master initiates', 'Keepalive: 5-15 s'],
      fix: ['Capture on the master side and look for SYN with no reply.', 'Ask the network team to allow master IP to RTU on 20000.', 'Check the RTU listens on the same port.', 'Confirm the session stays up past the firewall idle time.'],
      where: ['Firewall rule table', 'RTU: DNP3 TCP listen port'], resp: [] },
    { s: 2, sev: 'M', tags: ['Protocol', 'Serial', 'HexAnalysis'], t: 'Link-layer confirm mismatch: master expects an ACK the RTU never sends',
      site: 'Master configured for confirmed user data on a serial link; RTU configured for unconfirmed.',
      sym: 'Master retries every poll three times and then declares the link down, although the RTU replies.',
      ex: [{ l: 'Master frame requesting link confirmation (function 3)', k: 'hex', f: [0xC3, 10, 1, [0xC0, 0xC0, 0x01, 0x3C, 0x01, 0x06]], n: 'Control C3 = confirmed user data. The RTU must answer with a link ACK.' }],
      params: ['Link confirm: off on IP, off on clean serial', 'Link retries: 0-2'],
      fix: ['Read the master and RTU link confirm setting.', 'Set both to the same mode (usually never or sometimes).', 'Recapture and check the replies match.'],
      where: ['Master channel: link layer confirm mode', 'RTU: link confirm required'], resp: [{ l: 'Link ACK from the RTU', k: 'hex', f: [0x00, 1, 10, []], n: 'Control 00 = secondary ACK, no user data.' }] },
    { s: 2, sev: 'H', tags: ['Protocol', 'DEWA'], t: 'Time drifts over a radio link: Delay Measurement not used',
      site: 'SEWA remote site over licensed radio, round-trip delay about 300 ms.',
      sym: 'RTU time is always 150-300 ms behind the master after each sync.',
      ex: [{ l: 'Delay Measurement request (function 0x17)', k: 'hex', f: REQ([0xC0, 0xC0, 0x17]), n: 'Function 0x17 asks the RTU to report its processing delay.' }, { l: 'Expected response with g52 v2 delay', k: 'hex', f: [0x44, 1, 10, [0xC0, 0xC0, 0x81, 0x10, 0x00, 0x34, 0x02, 0x07, 0x01, 0x0A, 0x00]], n: 'g52 v2, count 1, delay 0x000A = 10 ms. IIN1.4 still set until the time write.' }],
      params: ['Delay Measurement: on', 'Time sync interval: 30 min', 'Radio: fixed latency, no store-and-forward'],
      fix: ['Enable Delay Measurement before each time write.', 'Check the master subtracts half the round trip.', 'Compare RTU and GPS time after the next sync.'],
      where: ['Master time sync settings', 'RTU: time source'], resp: [OK] },

    { s: 3, sev: 'H', tags: ['Protocol', 'Troubleshooting'], t: 'Zero deadband on frequency floods events at 50 Hz',
      site: 'GIS bay RTU with frequency point deadband 0.',
      sym: 'Class 2 events arrive continuously. Radio link is saturated and the historian grows fast.',
      ex: [{ l: 'IIN: Class 2 events available', k: 'iin', v: '04 00', n: 'IIN1.2 Class 2 events: nonstop with deadband 0.' }],
      params: ['Frequency deadband: 0.02 Hz', 'Voltage deadband: 0.5 percent', 'Current deadband: 1 percent'],
      fix: ['Read the point deadband in the RTU.', 'Set 0.02 Hz for frequency.', 'Poll events and confirm IIN1.2 clears between polls.', 'Run an integrity poll to resync.'],
      where: ['RTU point configuration: deadband per analogue input'], resp: [OK] },
    { s: 3, sev: 'H', tags: ['Protocol', 'DEWA'], t: 'Master shows stale values after RTU restart: no integrity poll',
      site: 'RTU power-cycled; master reconnects but never reads Class 0.',
      sym: 'Points keep old values until each changes. Operators see wrong breaker states.',
      ex: [{ l: 'Null unsolicited response after restart', k: 'hex', f: [0x44, 1, 10, [0xC0, 0xF0, 0x82, 0x80, 0x00]], n: 'Function 0x82 Unsolicited Response. Control byte F0 = FIR, FIN, CON, UNS. IIN1.7 Device Restart.' }, { l: 'Master confirm', k: 'hex', f: REQ([0xC0, 0xC0, 0x00]), n: 'Function 0x00 Confirm. Then send the integrity poll.' }],
      params: ['On restart: integrity poll Class 0, 1, 2, 3', 'Enable unsolicited after integrity completes'],
      fix: ['Confirm the null unsolicited response.', 'Send the integrity poll.', 'Clear Device Restart.', 'Enable unsolicited if used.'],
      where: ['Master: startup sequence or integrity-on-restart setting'], resp: [OKD] },
    { s: 3, sev: 'H', tags: ['Protocol', 'Troubleshooting'], t: 'Unsolicited storm after a feeder trip',
      site: 'RTU with 120 binary inputs on unsolicited; a trip operates many contacts at once.',
      sym: 'Dozens of unsolicited frames in under a second; master queue fills and some are never confirmed.',
      ex: [{ l: 'Unsolicited response needing confirm', k: 'hex', f: [0x44, 1, 10, [0xC0, 0xF1, 0x82, 0x02, 0x00]], n: 'Control F1: CON and UNS set, sequence 1.' }],
      params: ['Unsolicited hold time: 1-2 s', 'Maximum events per unsolicited message: 10-20', 'Confirm timeout: 5 s'],
      fix: ['Set a hold time and event count so reports group together.', 'Keep a slow integrity poll.', 'Check the master confirms each message.'],
      where: ['RTU: unsolicited hold time and count per class'], resp: [OK] },
    { s: 3, sev: 'M', tags: ['Protocol', 'DEWA'], t: 'Energy totals do not match: counters read at different times',
      site: 'Feeder energy read from two RTUs for a reconciliation report.',
      sym: 'Differences of several kWh between RTUs because counters were read at different instants.',
      ex: [{ l: 'Immediate Freeze on g20', k: 'hex', f: REQ([0xC0, 0xC0, 0x07, 0x14, 0x01, 0x06]), n: 'Function 0x07 Immediate Freeze, g20 v1, all points.' }],
      params: ['Freeze interval: 15 min on the hour', 'Read g21 after freeze', 'Counter rollover handled modulo 2^32'],
      fix: ['Send Immediate Freeze to every RTU together.', 'Read g21 frozen counters.', 'Compute differences with rollover handling.'],
      where: ['Master: freeze command schedule', 'RTU: counter point to frozen counter mapping'], resp: [OK] },
    { s: 3, sev: 'M', tags: ['Protocol', 'DEWA'], t: 'Trip alarms arrive late because status is in Class 3',
      site: 'Protection trip status mapped to Class 3 polled every 30 s.',
      sym: 'Operators see trip alarms 30 s late.',
      ex: [{ l: 'IIN: Class 3 events pending', k: 'iin', v: '08 00', n: 'IIN1.3 Class 3 events available (not Buffer Overflow).' }],
      params: ['Trips and breaker status: Class 1', 'Analogues: Class 2', 'Counters, diagnostics: Class 3'],
      fix: ['Move trip and breaker status points to Class 1.', 'Confirm the Class 1 poll interval.', 'Test by forcing a status change.'],
      where: ['RTU point configuration: event class per point'], resp: [OK] },
    { s: 3, sev: 'M', tags: ['Protocol', 'Serial'], t: 'Poll interval shorter than the frame time at 9600 baud',
      site: 'Master polls every 500 ms; a Class 0 response of about 400 bytes takes over one second at 9600 baud.',
      sym: 'Master sends the next request before the last response ends. Timeouts and retries appear.',
      ex: [{ l: 'Class 0 request', k: 'hex', f: REQ([0xC0, 0xC0, 0x01, 0x3C, 0x01, 0x06]), n: 'A 400-byte reply at 9600 baud takes about 0.42 s per 400 characters plus link overhead.' }],
      params: ['Time per byte at 9600 8N1: about 1.04 ms', 'Class 0 interval: well above reply time', 'Response timeout: 5 s'],
      fix: ['Estimate frame time: bytes x 1.04 ms.', 'Set poll interval above the reply time.', 'Raise baud rate if the cable allows it.'],
      where: ['Master scan table', 'Serial port settings on both ends'], resp: [OKD] },

    { s: 4, sev: 'C', tags: ['Protocol', 'DEWA', 'Cybersecurity'], t: 'Direct Operate used on a breaker instead of SBO',
      site: 'Commissioning engineer configured a feeder breaker as Direct Operate to simplify testing.',
      sym: 'The command executes without an arming step. Utility policy requires SBO on breakers.',
      ex: [{ l: 'Direct Operate frame (function 0x05)', k: 'hex', f: [0xC4, 10, 1, CROBQ(0x05, 3, 0x11, 0x64, 0x00)], n: 'Function 0x05 executes immediately. For breakers use Select (0x03) then Operate (0x04).' }],
      params: ['Control model: SBO for breakers and isolators', 'Direct Operate: only for non-critical points'],
      fix: ['Change the control model to SBO in both master and RTU.', 'Retest with Select, then Operate.', 'Record the control model in the point list.'],
      where: ['Master point table: control type', 'RTU: control model per output'], resp: [{ l: 'Expected Select response', k: 'hex', f: [0x44, 1, 10, CROBR(3, 0x11, 0x64, 0x00, 0)], n: 'Status 00.' }] },
    { s: 4, sev: 'H', tags: ['Protocol', 'Troubleshooting'], t: 'Control status 4 (Not Supported): wrong control code',
      site: 'Relay accepts pulse commands only; master sends latch on (0x03).',
      sym: 'Select returns status 4. No operation.',
      ex: [{ l: 'Select with latch on (0x03)', k: 'hex', f: [0xC4, 10, 1, CROBQ(0x03, 3, 0x03, 0x64, 0x00)], n: 'Control code 03 = latch on.' }, { l: 'Select with pulse close (0x11)', k: 'hex', f: [0xC4, 10, 1, CROBQ(0x03, 3, 0x11, 0x64, 0x00)], n: 'Control code 11 = pulse close.' }, { l: 'Expected rejection', k: 'hex', f: [0x44, 1, 10, CROBR(3, 0x03, 0x64, 0x00, 4)], n: 'Last byte 04 = Not Supported.' }],
      params: ['Close: 0x11 pulse close', 'Trip: 0x21 pulse trip', 'Latch codes: only if the relay supports them'],
      fix: ['Check the relay manual for supported codes.', 'Set pulse close and pulse trip in the master.', 'Retest on an isolated breaker.'],
      where: ['Master control point: control code', 'Relay or RTU: supported operations'], resp: [{ l: 'Expected Select response after fix', k: 'hex', f: [0x44, 1, 10, CROBR(3, 0x11, 0x64, 0x00, 0)], n: 'Status 00.' }] },
    { s: 4, sev: 'H', tags: ['Protocol', 'Troubleshooting'], t: 'Command sent to the wrong point: off-by-one index',
      site: 'Point list is one-based; the RTU expects zero-based. Master closes CB-03 at index 5 but the RTU maps CB-03 to index 4.',
      sym: 'A different breaker operates, or the RTU returns Object Unknown.',
      ex: [{ l: 'IIN: Object Unknown', k: 'iin', v: '00 02', n: 'IIN2.1 Object Unknown: point or variation not configured.' }],
      params: ['Index base: confirm zero-based or one-based', 'Test commands on a spare point first'],
      fix: ['Compare master and RTU point lists for each control.', 'Test with a spare output.', 'Fix the index offset and retest every control with the utility witness.'],
      where: ['RTU point list: DNP3 index column', 'Master point table: index offset'], resp: [OK] },
    { s: 4, sev: 'M', tags: ['Protocol', 'Troubleshooting'], t: 'Status 5 / IIN2.4: command already executing',
      site: 'Operator double-taps close on a slow breaker; the second command arrives during the first.',
      sym: 'Second command is rejected with Already Executing.',
      ex: [{ l: 'IIN: Already Executing', k: 'iin', v: '00 10', n: 'IIN2.4 Already Executing.' }],
      params: ['Master: block new commands until status returns', 'Pulse width: shorter than the command guard time'],
      fix: ['Add a guard in the master HMI.', 'Wait for the breaker status change.', 'Retry only after the first command completes.'],
      where: ['Master HMI command interlock settings'], resp: [OK] },

    { s: 5, sev: 'M', tags: ['HexAnalysis', 'Troubleshooting'], t: 'Link status request: is the RTU alive at link level?',
      site: 'Silent RTU. You want to test the data link without sending any application data.',
      sym: 'Polls time out. You need to know if the RTU link layer answers at all.',
      ex: [{ l: 'Request link status (function 9)', k: 'hex', f: [0xC9, 10, 1, []], n: 'Control C9 = master, primary, function 9. No user data.' }, { l: 'Expected link status reply', k: 'hex', f: [0x0B, 1, 10, []], n: 'Control 0B = outstation, secondary, function 11 Link status.' }],
      params: ['Link status poll: for diagnostics only', 'Keepalive: 5-15 s on IP'],
      fix: ['Send the frame above from a test master.', 'If the RTU answers 0B, the link is fine and the problem is above it.', 'If there is no answer, return to stage 1 and 2.'],
      where: ['Test master or protocol tester: raw frame send'], resp: [] },
    { s: 5, sev: 'M', tags: ['HexAnalysis', 'Troubleshooting'], t: 'Reading an Object Unknown response after an unsupported variation',
      site: 'Master asks g30 v6 (double float); the RTU supports only v1 and v5.',
      sym: 'Response carries IIN2.1 and no data. Master shows the point as invalid.',
      ex: [{ l: 'Read request for g30 v6', k: 'hex', f: REQ([0xC0, 0xC0, 0x01, 0x1E, 0x06, 0x06]), n: 'Group 30 (0x1E) variation 6.' }, { l: 'Response with Object Unknown', k: 'hex', f: RSP(0x00, 0x02), n: 'IIN2.1 set, no object data.' }],
      params: ['Use variation 1 or 5 on this RTU', 'Class 0 (g60 v1) always works'],
      fix: ['Find supported variations in the RTU Device Profile.', 'Request a supported variation or Class 0.', 'Update the master driver point table.'],
      where: ['Master point table: variation per point', 'RTU Device Profile document'], resp: [OKD] },
    { s: 5, sev: 'H', tags: ['Protocol', 'Troubleshooting', 'Cybersecurity'], t: 'Cold Restart command seen on the wire: who sent it?',
      site: 'RTU reboots at random; engineer suspects a restart command.',
      sym: 'Device Restart appears after every reboot. You need to prove a command caused it.',
      ex: [{ l: 'Cold Restart request (function 0x0D)', k: 'hex', f: REQ([0xC0, 0xC0, 0x0D]), n: 'Function 0x0D = 13 Cold Restart. If you see this in a capture, identify the source address.' }, { l: 'Expected response with delay object', k: 'hex', f: [0x44, 1, 10, [0xC0, 0xC0, 0x81, 0x00, 0x00, 0x34, 0x02, 0x07, 0x01, 0x14, 0x00]], n: 'The RTU reports the time until restart (g52 v2).' }],
      params: ['Restrict restart commands to engineering access', 'Log all control and restart commands'],
      fix: ['Capture for 24 hours with a mirror port.', 'Filter for function 0x0D and 0x0E.', 'Identify the source and remove the cause.'],
      where: ['Switch SPAN port', 'Wireshark display filter on dnp3'], resp: [] }
  );

  SCEN.forEach(function (s, i) { s.id = 1000 + i; });

  function tipStage(t) {
    if (/SBO|Select|CROB|control|pulse|operate|breaker/i.test(t.title)) return 4;
    if (t.cat === 'Serial' || t.cat === 'Environment') return 1;
    if (t.cat === 'HexAnalysis' || t.cat === 'Troubleshooting') return 5;
    if (t.cat === 'Protocol') return /address|index|time|UTC|restart|fragment|TCP|link/i.test(t.title) ? 2 : 3;
    return 2;
  }
  TIPS.forEach(function (t) { t.stage = tipStage(t); });

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
    q: '', tag: 'all', stage: 'all', sort: 'default',
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
    if (state.stage !== 'all' && t.stage !== state.stage) return false;
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
    var sc = renderScenarios();
    $('empty').hidden = (list.length + sc) > 0;
    $('resultCount').textContent = list.length + ' of ' + TIPS.length + ' quick tips';
    $('scenCount').textContent = sc + ' of ' + SCEN.length;
    renderStages();
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

  // ---------- scenarios ----------
  function frameHex(ex) {
    if (ex.k === 'raw') return ex.v;
    var b = buildFrame(ex.f[0], ex.f[1], ex.f[2], ex.f[3]);
    if (ex.m === 'badcrc') b[10] ^= 0x01;
    if (ex.m === 'trunc') b = b.slice(0, b.length - 6);
    return b.map(hex2).join(' ');
  }

  function scenMatches(s) {
    if (state.stage !== 'all' && s.s !== state.stage) return false;
    if (state.tag === 'bookmarks' && state.bookmarks.indexOf(s.id) < 0) return false;
    if (state.tag !== 'all' && state.tag !== 'bookmarks' && s.tags.indexOf(state.tag) < 0) return false;
    if (state.q) {
      var hay = (s.t + ' ' + s.site + ' ' + s.sym + ' ' + s.params.join(' ') + ' ' + s.fix.join(' ') + ' ' + (s.where || []).join(' ') + ' ' + s.tags.join(' ')).toLowerCase();
      var words = state.q.toLowerCase().split(/\s+/);
      for (var i = 0; i < words.length; i++) { if (words[i] && hay.indexOf(words[i]) < 0) return false; }
    }
    return true;
  }

  function exBlock(list, idx, kind, resp) {
    return list.map(function (e, j) {
      var body = e.k === 'iin' ? 'IIN1 = ' + e.v.split(' ')[0] + '   IIN2 = ' + (e.v.split(' ')[1] || '00') : frameHex(e);
      var ref = idx + ':' + kind + ':' + j;
      return '<div class="ex' + (resp ? ' ex-resp' : '') + '"><div class="ex-l">' + esc(e.l) + '</div><pre class="hexbox mono">' + esc(body) + '</pre>' +
        '<p class="ex-n">' + esc(e.n) + '</p><div class="btn-row tight">' +
        '<button type="button" class="btn btn-accent" data-try="' + ref + '">Try example</button>' +
        (e.k !== 'iin' ? '<button type="button" class="btn" data-sc-copy="' + ref + '">Copy hex</button>' : '') + '</div></div>';
    }).join('');
  }

  function scenHTML(s) {
    var saved = state.bookmarks.indexOf(s.id) >= 0;
    var inList = state.checklist.some(function (c) { return c.id === s.id; });
    var idx = SCEN.indexOf(s);
    return '<article class="scen sev-' + s.sev + '" data-scen="' + s.id + '">' +
      '<div class="card-top"><span class="stage-badge">Stage ' + s.s + '</span><span class="sev">' + SEV[s.sev] + '</span>' +
      '<button type="button" class="bm' + (saved ? ' is-saved' : '') + '" data-bm="' + s.id + '" aria-pressed="' + saved + '" aria-label="' + (saved ? 'Remove bookmark' : 'Bookmark scenario') + '">' + (saved ? '&#9733;' : '&#9734;') + '</button></div>' +
      '<h3>' + esc(s.t) + '</h3>' +
      '<section class="blk"><h4>Site context</h4><p>' + esc(s.site) + '</p></section>' +
      '<section class="blk bad"><h4>What goes wrong</h4><p>' + esc(s.sym) + '</p></section>' +
      '<section class="blk good"><h4>Actionable fix</h4><ol class="fix">' + s.fix.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ol>' +
      (s.where && s.where.length ? '<h5>Where to change it (menu names vary by vendor)</h5><ul class="where">' + s.where.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '') + '</section>' +
      (s.ex.length ? '<section class="blk"><h4>Request / trace example</h4>' + exBlock(s.ex, idx, 'e', false) + '</section>' : '') +
      (s.resp && s.resp.length ? '<section class="blk ok"><h4>Expected response once fixed</h4>' + exBlock(s.resp, idx, 'r', true) + '</section>' : '') +
      '<section class="blk"><h4>Settings to apply</h4><ul class="params mono">' + s.params.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></section>' +
      '<div class="tags">' + s.tags.map(function (g) { return '<span class="tag">#' + esc(g) + '</span>'; }).join('') + '</div>' +
      '<div class="btn-row"><button type="button" class="btn" data-sc-check="' + s.id + '">' + (inList ? 'Remove from checklist' : 'Add to checklist') + '</button></div></article>';
  }

  function renderScenarios() {
    var list = SCEN.filter(scenMatches);
    $('scenarios').innerHTML = list.map(scenHTML).join('');
    return list.length;
  }

  function renderStages() {
    var html = '<button type="button" class="stage-btn' + (state.stage === 'all' ? ' is-active' : '') + '" data-stage="all">All stages</button>';
    STAGES.forEach(function (g) {
      var n = SCEN.filter(function (s) { return s.s === g.n; }).length;
      html += '<button type="button" class="stage-btn' + (state.stage === g.n ? ' is-active' : '') + '" data-stage="' + g.n + '"><b>' + g.n + '</b> ' + esc(g.short) + ' <small>' + n + '</small></button>';
    });
    $('stages').innerHTML = html;
    var cur = STAGES.filter(function (g) { return g.n === state.stage; })[0];
    $('stageDesc').textContent = cur ? cur.title + '. ' + cur.desc : 'Pick a commissioning stage, or browse all scenarios.';
  }

  function tryExample(idx, kind, j) {
    var e = (kind === 'r' ? SCEN[idx].resp : SCEN[idx].ex)[j];
    if (e.k === 'iin') {
      var p = e.v.split(' ');
      $('iin1').value = p[0]; $('iin2').value = p[1] || '00';
      decodeIIN();
      $('iinTitle').scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast('IIN decoded: scroll up to see the result');
    } else {
      $('hexInput').value = frameHex(e);
      inspectFrame();
      $('hexTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('Frame loaded into the inspector');
    }
  }

  // ---------- modal ----------
  var modalFocus = null;
  function findTip(id) {
    for (var i = 0; i < TIPS.length; i++) if (TIPS[i].id === id) return TIPS[i];
    for (var j = 0; j < SCEN.length; j++) if (SCEN[j].id === id) return { id: id, title: SCEN[j].t };
    return null;
  }

  function openModal(id) {
    if (id >= 1000) { var el = document.querySelector('[data-scen="' + id + '"]'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.classList.add('flash'); setTimeout(function () { el.classList.remove('flash'); }, 1600); } return; }
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
    rows.push(row('Link control', hex2(ctl), (dir ? 'From master' : 'From outstation') + ', ' + (prm ? 'primary' : 'secondary') + ', function ' + fn + ' ' + fnName + (prm ? '. PRM=1 means this station started the link transfer; it does not mean unsolicited.' : '')));
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
      if (prm && !dir && af === 129) rows.push(row('Link vs application', '', 'Solicited response: outstations send even normal replies as primary frames (control 0x44, unconfirmed user data). The application function 0x81 shows it answers a master request; unsolicited would be 0x82 with UNS set.'));
      if (prm && !dir && af === 130) rows.push(row('Link vs application', '', 'Unsolicited response: sent by the outstation without a request (function 0x82, UNS bit set in the application control byte).'));
      if (prm && dir && af !== 129 && af !== 130) rows.push(row('Link vs application', '', 'Master request in a primary frame (control 0xC4, unconfirmed user data); the outstation answers with a response in its own primary frame.'));
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
    $('resetFilters').addEventListener('click', function () { $('search').value = ''; state.q = ''; state.stage = 'all'; setTag('all'); });

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

    $('stages').addEventListener('click', function (e) {
      var b = e.target.closest('[data-stage]'); if (!b) return;
      var v = b.getAttribute('data-stage');
      state.stage = v === 'all' ? 'all' : parseInt(v, 10);
      render();
    });
    $('scenarios').addEventListener('click', function (e) {
      var bm = e.target.closest('[data-bm]');
      if (bm) { toggleBookmark(parseInt(bm.getAttribute('data-bm'), 10)); return; }
      var tr = e.target.closest('[data-try]');
      if (tr) { var a = tr.getAttribute('data-try').split(':'); tryExample(+a[0], a[1], +a[2]); return; }
      var cp = e.target.closest('[data-sc-copy]');
      if (cp) { var c = cp.getAttribute('data-sc-copy').split(':'); copyText(frameHex((c[1] === 'r' ? SCEN[+c[0]].resp : SCEN[+c[0]].ex)[+c[2]]), 'Hex copied'); return; }
      var ck = e.target.closest('[data-sc-check]');
      if (ck) toggleChecklist(parseInt(ck.getAttribute('data-sc-check'), 10));
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
