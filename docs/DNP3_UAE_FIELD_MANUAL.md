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

Status codes: 0 Success, 1 Timeout, 2 No select, 3 Format error, 4 Not supported, 7 Local, 8 Too many objects, 9 Not authorized.

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

## 13. CROB control codes (IEEE 1815)
The control code byte is: bits 6-7 trip/close code (1 close, 2 trip), bit 5 clear, bit 4 queue, bits 0-3 operation (1 pulse on, 2 pulse off, 3 latch on, 4 latch off).

| Code | Meaning |
|---|---|
| 0x41 | Close (code 1) + pulse on (operation 1) |
| 0x81 | Trip (code 2) + pulse on (operation 1) |
| 0x03 | Latch on |
| 0x04 | Latch off |

## 14. Secure Authentication (SAv5, group 120)
g120 v1 Challenge, v2 Reply, v3 Aggressive mode request, v4 Session key status request, v5 Session key status, v6 Session key change, v7 Error, v9 HMAC.
If the utility specification (DESC / UAE IA) requires SAv5 and breaker controls fail or are dropped silently, check SAv5 is enabled on both sides and update keys and session keys are loaded. A rejected control normally returns status 0x09 Not Authorized; 0x07 is Local.

Clocks: SAv5 challenge-reply does not depend on synchronised clocks, and the standard defines no time-skew error. The g120 v7 error codes include 1 Authentication failed and 4 Aggressive mode not supported. Drifting clocks do not make the RTU reject a reply, but they still corrupt event timestamps and any certificate-based key validity, so keep time sync (g50) correct. Typical causes of a rejected reply are mismatched keys, a wrong user number, an unsupported MAC algorithm or an aggressive-mode mismatch.

## 15. DNP3 to IEC 60870-5-104 conversion
| DNP3 | IEC 104 | Note |
|---|---|---|
| g1 / g2 binary input | M_SP_NA_1 (Type 1), with time M_SP_TB_1 (Type 30) | Double point (Type 3) needs two binaries |
| g12 CROB | C_DC_NA_1 (Type 46) or C_SC_NA_1 (Type 45) | Close 0x41 = DCS 2, trip 0x81 = DCS 1; Select = S/E 1. Type 46 is expected for switchgear circuit breakers (Trip/Close): do not map DNP3 CROB breakers to Type 45 in utility transmission and distribution networks. Confirm in the utility interface specification. |
| g30 / g32 analogue | M_ME_NA_1 (Type 9), M_ME_NB_1 (Type 11), M_ME_NC_1 (Type 13) | Prefer scaled or float |
| g20 / g21 / g22 counters | M_IT_NA_1 (Type 15), with time M_IT_TB_1 (Type 37) | Freeze maps to C_CI_NA_1 (Type 101) |
| Class 0 poll | C_IC_NA_1 (Type 100) | Events map to spontaneous (COT 3) |
| g50 v1 time write | C_CS_NA_1 (Type 103) | UTC; keep the summer-time bit 0 in the UAE |
| IIN1.7 Device Restart | M_EI_NA_1 (Type 70) | End of initialisation |

## 16. Timestamps
DNP3 time is 48-bit UTC. The UAE uses GST (UTC+4, no DST). A 4-hour offset in SCADA means local time was sent as UTC or the UTC-offset setting is missing in the RTU or master.

## 17. Implementation levels
Levels are cumulative. Host and device levels are independent, so compare both Device Profiles.

| Level | Adds |
|---|---|
| 1 | Minimum master-to-IED communication: simple reads and writes, class and static polling, unsolicited messages |
| 2 | Counter freeze requests; more variation and object read combinations, including binary input events |
| 3 | Wider range of read requests; enable/disable unsolicited by Class 1, 2, 3 |
| 4 | Self-address (0xFFFC), device attributes (g0), double-bit inputs, variations with time, floating-point analogue variations |

File transfer (g70), Secure Authentication (g120), data sets and virtual terminal are optional and not required at any level. A Level 2 device asked for g30v5 float answers Object Unknown (IIN2.1). Read the device profile for control (g12), deadband (g34) and time sync support.

## 18. Special link addresses
0xFFFF broadcast (link confirm optional), 0xFFFE broadcast (confirm mandatory), 0xFFFD broadcast (no confirm), 0xFFFC self-address (optional feature), 0xFFF0-0xFFFB reserved. Outstations do not reply to broadcast requests, so a broadcast Read returns nothing. Broadcast is normally used for writes such as time sync, restarts, freezes or enabling unsolicited.

## 19. Direct Operate on breakers
Direct Operate (0x05) and Direct Operate No Ack (0x06) execute without a Select step, and 0x06 gives no response. Disable both for high-voltage breaker points so every control needs Select then Operate, and confirm in the utility specification.

## 20. CRC-16 specification (link layer)
DNP3 Link Layer CRC-16: Polynomial 0x3D65 | Initial Seed 0x0000 | Final XOR 0xFFFF | Inverted and little-endian.

- Algorithm: CRC-16/DNP, reflected (input and output bits reversed). Reflected polynomial for shift-right code: 0xA6BC.
- 0x3D65 = x^16 + x^13 + x^12 + x^11 + x^10 + x^8 + x^6 + x^5 + x^2 + 1.
- Check value: CRC of ASCII "123456789" = 0xEA82.
- Frame test: header 05 64 05 C0 01 00 00 04 gives 0x21E9, transmitted as E9 21.
- One CRC covers the 8 header bytes. Each data block of up to 16 bytes then carries its own CRC.

```
crc = 0
for each byte b:
    crc ^= b
    repeat 8 times:
        crc = (crc >> 1) ^ 0xA6BC if (crc & 1) else crc >> 1
crc = ~crc & 0xFFFF      # send low byte first
```
