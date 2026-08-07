# 🏛️ End-to-End Architecture & Design Specification

> **Project**: Anti-Fraud Event Access Control & QR Verification System  
> **Document Version**: 1.0.0  
> **Security Level**: Zero-Trust / Asymmetric Data Visibility

---

## 1. System Philosophy & Strategic Pillars

### 1.1 Pre-Authorized Access Only
Entry tickets cannot be generated on demand by unverified users. The system enforces strict pre-authorization:
- Administrators populate a master spreadsheet (`Student_Master`) with approved participant credentials prior to ticket issuance.
- When a student attempts to request a ticket, their `Roll Number` and `Email` are validated server-side against `Student_Master`.
- If the credentials do not exist in the database, ticket generation is blocked immediately.

### 1.2 Multi-Layer Obfuscation (Asymmetric Data Visibility)
Standard event QR codes embed cleartext URLs, email addresses, or JSON strings. This exposes PII to any optical reader or third-party camera.
Our architecture enforces **Asymmetric Visibility**:
- **Standard Readers (Google Lens, iPhone Camera, Barcode Scanners)**: Decode only a non-functional hexadecimal string. No URLs to open, no vCards to save, no readable text.
- **Admin Scanner App**: Possesses synchronized decryption logic and cryptographic keys. Decrypts the hex stream back into validated JSON payload in milliseconds.

### 1.3 Single Source of Truth Backend
- **Zero Database Costs**: Uses Google Sheets as the relational store and Google Apps Script V8 Engine as a serverless REST API layer.
- **Real-Time Consistency**: Eliminates local offline database drift across multiple gate scanners.

### 1.4 Real-Time Anti-Passback & Fraud Prevention
- Gate scanners post check-in requests directly to the Apps Script backend upon successful decryption.
- The script checks `Attendance_Logs` for existing check-in entries using the unique `Roll_Number`.
- If a duplicate attempt is detected (e.g. screenshot sharing), the Admin app immediately issues a red visual warning card and triggers an auditory alarm chime.

---

## 2. Component Topology & Data Flow

```
                                  ┌──────────────────────────┐
                                  │      Google Sheets       │
                                  │  (Master & Attendance)   │
                                  └────────────▲─────────────┘
                                               │
                                       Google Apps Script
                                            (API)
                                       ▲           ▲
                    1. Verify Student  │           │  3. Post Check-in Log
                       & Fetch Details │           │     & Check Duplicates
                                       │           │
       ┌───────────────────────────────┴──┐     ┌──┴───────────────────────────────┐
       │     Student Web Portal           │     │     Admin Scanner App            │
       │              (/)                 │     │          (/admin)                │
       │ - Authenticates Identity         │     │ - Camera Feed Scans Hex Code     │
       │ - Runs Multi-Layer Cryptography  │     │ - Runs Reverse Decryption Pipeline│
       │ - Renders Encrypted QR Ticket    │     │ - Displays Real-Time Verification│
       └────────────────┬─────────────────┘     └──────────────────────────────────┘
                        │
                        │ 2. Displays QR Code (Physical / Digital)
                        ▼
            [ Unreadable Encrypted QR ]
```

---

## 3. End-to-End Lifecycle Phases

### Phase A: Database Pre-Loading (Admin Setup)
1. Organizers populate the Google Sheet tab `Student_Master` with columns: `Roll_Number`, `Name`, `Email`, `Account_Created`.
2. The `Attendance_Logs` tab is initialized with headers: `Roll_Number`, `Name`, `Email`, `Timestamp`, `Device_ID`.

### Phase B: Student Authentication & Pass Issuance
1. Student enters `Roll_Number` and `Email` on the Student Web Portal.
2. Web portal dispatches a `POST verify_student` request to Google Apps Script.
3. If verified, Apps Script returns `{ status: "SUCCESS", data: { roll, name, email } }`.
4. Browser constructs the payload:
   ```json
   {
     "roll": "2024CS01",
     "name": "Pavan Kandala",
     "email": "pavan@example.com",
     "issued": 1770000000
   }
   ```
5. Client-side `cryptoEngine` executes:
   - `HMAC-SHA256` signature generation
   - `AES-256-CBC` encryption
   - `Triple-DES-CBC` encryption
   - `Bitwise XOR` array mask shift
   - `Hexadecimal` encoding
6. QR generator renders vector QR code containing the raw Hex string.

### Phase C: Gate Scanning & Attendance Logging
1. Gate staff opens `/admin` on a mobile device and inputs passcode.
2. Scanner activates WebRTC camera preview (`html5-qrcode`).
3. Upon decoding a Hex string from the optical frame:
   - Reverses Hex string to byte array
   - Reverses Bitwise XOR mask
   - Decrypts Triple-DES cipher
   - Decrypts AES-256 cipher
   - Re-computes and matches HMAC-SHA256 signature
4. If HMAC checksum fails or decryption throws an exception, scanner flags `TAMPERED TICKET`.
5. If HMAC succeeds, scanner dispatches `POST check_in` with `Roll_Number`.
6. Apps Script checks `Attendance_Logs`:
   - **First Check-in**: Inserts log row, returns `{ status: "SUCCESS" }`. App displays Green screen & plays success chime.
   - **Duplicate Check-in**: Returns `{ status: "DUPLICATE", previousTimestamp: "18:30:12" }`. App displays Amber/Red screen & plays warning alarm.

---

## 4. Threat Matrix & Mitigation Strategies

| Threat Vector | Attack Scenario | Mitigation |
| :--- | :--- | :--- |
| **Passback / Ticket Reuse** | Student passes screenshot of QR ticket to a friend outside the venue. | Real-time server-side `Attendance_Logs` lookup flags duplicate roll number check-ins immediately with exact prior check-in timestamp. |
| **Optical Eavesdropping** | Nearby person takes a photo of a student's displayed QR code. | QR contains no PII or URLs; standard camera preview displays meaningless hex string. |
| **Payload Tampering** | Attacker modifies hex digits to change Roll Number or Name. | HMAC-SHA256 integrity checksum verification fails during decryption, flagging `TAMPERED TICKET`. |
| **Unauthorized Pass Generation** | Attacker creates custom ticket using student's known credentials. | Student identity must exist in pre-loaded `Student_Master` sheet; cryptographic secret keys & salt prevent unauthorized encryption synthesis. |
| **Database Corruption / Loss** | High traffic causes concurrent write locks or database server crash. | Google Apps Script uses atomic LockService lock guards (`LockService.getScriptLock()`) during sheet updates. |
