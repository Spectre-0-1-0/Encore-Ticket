# 📊 Data Schemas & API Endpoint Specifications

> **Document Version**: 1.0.0  
> **Target API**: Google Apps Script Web App REST API  
> **Format**: JSON over HTTP POST / GET

---

## 1. Database Tab Schemas

### 1.1 `Student_Master` Tab
Stores pre-approved participant details uploaded by administrators prior to ticket distribution.

```json
{
  "tableName": "Student_Master",
  "columns": [
    { "index": 0, "name": "Roll_Number", "type": "string", "example": "2024CS01", "primaryKey": true },
    { "index": 1, "name": "Name", "type": "string", "example": "Pavan Kandala" },
    { "index": 2, "name": "Email", "type": "string", "example": "pavan@example.com" },
    { "index": 3, "name": "Account_Created", "type": "boolean", "example": true }
  ]
}
```

### 1.2 `Attendance_Logs` Tab
Stores real-time entry logs created when the Admin Scanner validates a student at the gate.

```json
{
  "tableName": "Attendance_Logs",
  "columns": [
    { "index": 0, "name": "Roll_Number", "type": "string", "example": "2024CS01", "foreignKey": "Student_Master.Roll_Number" },
    { "index": 1, "name": "Name", "type": "string", "example": "Pavan Kandala" },
    { "index": 2, "name": "Email", "type": "string", "example": "pavan@example.com" },
    { "index": 3, "name": "Timestamp", "type": "string (ISO8601)", "example": "2026-08-06T18:30:12.123Z" },
    { "index": 4, "name": "Device_ID", "type": "string", "example": "GATE_SCANNER_01" }
  ]
}
```

---

## 2. Decrypted Ticket Payload Schema (Client-side JSON)

Constructed on the Student Web Portal and encrypted into the Hex QR Code payload.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "DecryptedTicketPayload",
  "required": ["p", "h"],
  "properties": {
    "p": {
      "type": "object",
      "description": "Student Profile Object",
      "required": ["roll", "name", "email", "ts"],
      "properties": {
        "roll": { "type": "string", "example": "2024CS01" },
        "name": { "type": "string", "example": "Pavan Kandala" },
        "email": { "type": "string", "format": "email", "example": "pavan@example.com" },
        "ts": { "type": "integer", "description": "Unix Timestamp (Seconds)", "example": 1770000000 }
      }
    },
    "h": {
      "type": "string",
      "description": "SHA-256 HMAC checksum computed over stringified payload 'p' using secret HMAC_SALT",
      "example": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  }
}
```

---

## 3. Google Apps Script REST API Endpoint Contracts

### 3.1 Endpoint 1: Student Verification (`verify_student`)
Called by the Student Portal (`/`) to check if the roll number and email match an authorized pre-loaded record.

#### Request Payload (`POST`)
```json
{
  "action": "verify_student",
  "rollNumber": "2024CS01",
  "email": "pavan@example.com"
}
```

#### Success Response (`200 OK`)
```json
{
  "status": "SUCCESS",
  "data": {
    "roll": "2024CS01",
    "name": "Pavan Kandala",
    "email": "pavan@example.com"
  }
}
```

#### Denied Response (`200 OK`)
```json
{
  "status": "DENIED",
  "message": "Credentials do not match our pre-approved participant database."
}
```

---

### 3.2 Endpoint 2: Gate Check-in & Anti-Passback Validation (`check_in`)
Called by the Admin Scanner App (`/admin`) upon successfully decrypting a ticket QR payload.

#### Request Payload (`POST`)
```json
{
  "action": "check_in",
  "rollNumber": "2024CS01",
  "name": "Pavan Kandala",
  "email": "pavan@example.com",
  "deviceId": "ADMIN_GATE_01"
}
```

#### First-time Entry Response (`200 OK`)
```json
{
  "status": "SUCCESS",
  "message": "Check-in confirmed!",
  "data": {
    "roll": "2024CS01",
    "name": "Pavan Kandala",
    "email": "pavan@example.com",
    "timestamp": "2026-08-06T18:30:12.123Z",
    "deviceId": "ADMIN_GATE_01"
  }
}
```

#### Duplicate Entry Alert Response (`200 OK`)
```json
{
  "status": "DUPLICATE",
  "message": "Student already checked in!",
  "data": {
    "roll": "2024CS01",
    "name": "Pavan Kandala",
    "email": "pavan@example.com",
    "timestamp": "2026-08-06T18:30:12.123Z",
    "deviceId": "ADMIN_GATE_01"
  }
}
```
