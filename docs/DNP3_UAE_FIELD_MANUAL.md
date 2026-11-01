# DNP3 UAE Field Manual

Offline reference for commissioning DNP3 RTUs and gateways on UAE utility networks. Treat every value as a starting point and confirm it against the utility specification and device manual.

## 1. Conformance levels
Compare the master and outstation Device Profile Documents before FAT. Higher levels add object variations, event types and fragment handling. Record any deviations in the FAT report.

## 2. Scan strategy
| Class | Typical content | Event poll |
|---|---|---|
| 0 | All static data | Integrity poll every 15-60 min |
| 1 | Breaker status, protection trips | 2-5 s |
| 2 | Analogue changes, tap position | 5-10 s |
| 3 | Counters, diagnostics | 10-30 s |

Startup sequence: connect, read Class 0 then Classes 1, 2, 3, then enable unsolicited (FC 0x14) if used. Keep a slow integrity poll running with unsolicited enabled.

## 3. Select-before-operate
1. Master sends Select (FC 0x03) with the CROB.
2. Outstation replies with status 0 (Success) and arms the point.
3. Master sends Operate (FC 0x04) with identical objects and application sequence = Select + 1, inside the select timeout (typically 5-10 s).
4. Outstation executes and replies.

Status codes: 0 Success, 1 Timeout, 2 No select, 3 Format error, 4 Not supported, 7 Local, 8 Too many operations.

## 4. Frame anatomy
`05 64 LEN CTRL DEST(2) SRC(2) CRC(2)` followed by 16-byte data blocks, each with a CRC. LEN = 5 + user data bytes. CRC-16 uses polynomial 0x3D65, sent low byte first. Addresses are little-endian.

Transport byte: FIR bit 7, FIN bit 6, SEQ bits 0-5. Application control: FIR 0x80, FIN 0x40, CON 0x20, UNS 0x10, SEQ bits 0-3.

Function codes: 01 Read, 02 Write, 03 Select, 04 Operate, 05 Direct Operate, 07 Immediate Freeze, 14 Enable Unsolicited, 17 Delay Measurement, 81 Response, 82 Unsolicited Response.

Example integrity poll: `05 64 14 C4 0A 00 01 00 <CRC> C0 C0 01 3C 02 06 3C 03 06 3C 04 06 3C 01 06 <CRC>`

## 5. IIN bits
IIN1: 0 Broadcast, 1 Class 1 events, 2 Class 2 events, 3 Class 3 events, 4 Need Time, 5 Local Control, 6 Device Trouble, 7 Device Restart.
IIN2: 0 No function code support, 1 Object unknown, 2 Parameter error, 3 Event buffer overflow, 4 Already executing, 5 Configuration corrupt.

## 6. Object cheat sheet
| Group | Variation | Meaning |
|---|---|---|
| 1 | 1 / 2 | Binary input packed / with flags |
| 2 | 1 / 2 / 3 | Binary event: no time / absolute time / relative time |
| 10 | 2 | Binary output status |
| 12 | 1 | CROB |
| 20 / 21 / 22 | 1 | Counter / frozen counter / counter event |
| 30 | 1, 2, 5 | Analogue 32-bit, 16-bit, float |
| 32 | 1, 3, 7 | Analogue event 32-bit, 32-bit with time, float with time |
| 50 / 51 | 1 | Time and date / CTO |
| 60 | 1-4 | Class 0, 1, 2, 3 |
| 80 | 1 | Internal indications |

Qualifiers: 06 all objects, 00/01 start-stop, 07/08 count, 17/28 count with index prefix.

## 7. Serial layer checklist
- 120 ohm termination at the two physical ends only.
- Bias at one point only, with 200 mV or more differential idle.
- Same baud, parity and stop bits on every node (9600-115200).
- Shield grounded at one end. Use fibre or isolated converters between buildings.
- Maximum 32 unit loads; stubs under 0.5 m.

## 8. Ethernet layer checklist
- Dedicated VLAN, managed switches, unused ports shut.
- Port 20000 only from the master IP.
- TCP keepalive 5-15 s, shorter than firewall idle timeouts.
- Fixed IPs and documented addressing.
- NTP/SNTP or PTP for time.

## 9. Heat and environment in UAE substations
- Allow for +55 C ambient plus 10-20 K solar rise inside kiosks; read derating curves.
- Battery life roughly halves per 8-10 C above 25 C.
- Use sunshields, light paint, sand-filtered ventilation and thermostat heaters.
- Coastal sites: IP66 or NEMA 4X, 316L stainless fixings, conformal coating (IPC-CC-830), no dissimilar metals.
- Fit SPDs and measure earth resistance at SAT.

## 10. Time
DNP3 time is UTC milliseconds since 1970. The UAE is UTC+4 with no daylight saving. Sync on Need Time or every 10-60 minutes, and use Delay Measurement on slow links.

## 11. Cybersecurity
Follow current DESC ISR and UAE IA Regulation requirements as given by the utility. Restrict the RTU to master traffic, disable unused services, change default credentials and back up baseline configs.

## 12. Commissioning sign-off
- [ ] Device Profiles compared
- [ ] Point list revision signed
- [ ] Point-to-point test complete with witness
- [ ] SBO tested on every control
- [ ] Power-cycle test (restart, null unsolicited, integrity poll)
- [ ] Failover test
- [ ] Time sync verified
- [ ] Config backed up and as-built recorded
