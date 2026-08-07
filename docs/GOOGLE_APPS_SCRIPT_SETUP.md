# ⚡ Google Apps Script & Google Sheets Backend Setup

> **Document Version**: 1.0.0  
> **Backend Type**: Google Apps Script (V8 Runtime Web App REST API)  
> **Database**: Google Sheets (`Student_Master` & `Attendance_Logs`)

---

## 1. Overview

The system uses a **Google Sheet** as its central database and **Google Apps Script (GAS)** as its serverless API layer. This eliminates backend hosting costs while providing real-time data persistence, concurrency protection, and easy management for event organizers.

---

## 2. Google Sheet Structure Setup

1. Open [Google Sheets](https://sheets.new) and create a new spreadsheet named **`Event_Access_Control_DB`**.
2. Create two tabs in the spreadsheet with the exact names below:

### Tab 1: `Student_Master`
Pre-populated with approved participant records prior to event launch.

| Column | Header Name | Data Type | Description |
| :--- | :--- | :--- | :--- |
| **A** | `Roll_Number` | String | Unique Roll / ID Number (Primary Key) |
| **B** | `Name` | String | Participant Full Name |
| **C** | `Email` | String | Registered Email Address |
| **D** | `Account_Created` | Boolean / String | Set to `TRUE` upon first ticket generation |

### Tab 2: `Attendance_Logs`
Updated in real time by gate scanners during event check-in.

| Column | Header Name | Data Type | Description |
| :--- | :--- | :--- | :--- |
| **A** | `Roll_Number` | String | Student Roll Number |
| **B** | `Name` | String | Participant Full Name |
| **C** | `Email` | String | Registered Email Address |
| **D** | `Timestamp` | ISO 8601 String | Exact check-in timestamp (`YYYY-MM-DDTHH:mm:ss.sssZ`) |
| **E** | `Device_ID` | String | Scanner device identifier |

---

## 3. Production Google Apps Script (`Code.gs`)

Follow these steps to attach the API script to your Google Sheet:
1. In your Google Sheet, click **Extensions** > **Apps Script**.
2. Replace all existing code in `Code.gs` with the following production-ready code:

```javascript
/**
 * Anti-Fraud Event Access Control System - Google Apps Script REST API
 * Version: 1.0.0
 */

// Configuration Constants
const SHEET_STUDENT_MASTER = "Student_Master";
const SHEET_ATTENDANCE_LOGS = "Attendance_Logs";

/**
 * Main HTTP POST Router
 */
function doPost(e) {
  return handleRequest(e);
}

/**
 * Main HTTP GET Router (Fallback & CORS preflight support)
 */
function doGet(e) {
  return handleRequest(e);
}

/**
 * Handle incoming API Requests
 */
function handleRequest(e) {
  const lock = LockService.getScriptLock();
  // Request lock with a 10-second timeout to handle high concurrency at gate entry
  try {
    lock.waitLock(10000);
  } catch (err) {
    return createJsonResponse({
      status: "ERROR",
      message: "Server busy. Please try scanning again."
    }, 503);
  }

  try {
    let payload = {};
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action;

    if (action === "verify_student") {
      return handleVerifyStudent(payload);
    } else if (action === "check_in") {
      return handleCheckIn(payload);
    } else if (action === "ping") {
      return createJsonResponse({ status: "SUCCESS", message: "API active" });
    } else {
      return createJsonResponse({
        status: "ERROR",
        message: "Invalid API action specified."
      }, 400);
    }
  } catch (error) {
    return createJsonResponse({
      status: "ERROR",
      message: "Server exception: " + error.toString()
    }, 500);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Action 1: Verify Student Credentials
 * Inputs: rollNumber, email
 */
function handleVerifyStudent(payload) {
  const rollNumber = (payload.rollNumber || "").toString().trim().toUpperCase();
  const email = (payload.email || "").toString().trim().toLowerCase();

  if (!rollNumber || !email) {
    return createJsonResponse({
      status: "ERROR",
      message: "Roll Number and Email are required."
    });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName(SHEET_STUDENT_MASTER);

  if (!masterSheet) {
    return createJsonResponse({
      status: "ERROR",
      message: "Student_Master sheet not found."
    });
  }

  const data = masterSheet.getDataRange().getValues();
  // Assume Row 1 is headers: [Roll_Number, Name, Email, Account_Created]
  for (let i = 1; i < data.length; i++) {
    const rowRoll = data[i][0].toString().trim().toUpperCase();
    const rowEmail = data[i][2].toString().trim().toLowerCase();

    if (rowRoll === rollNumber && rowEmail === email) {
      // Record verification
      masterSheet.getRange(i + 1, 4).setValue(true); // Set Account_Created = true
      
      return createJsonResponse({
        status: "SUCCESS",
        data: {
          roll: data[i][0].toString().trim(),
          name: data[i][1].toString().trim(),
          email: data[i][2].toString().trim()
        }
      });
    }
  }

  return createJsonResponse({
    status: "DENIED",
    message: "Credentials do not match our pre-approved database."
  });
}

/**
 * Action 2: Check-in Student & Duplicate Check
 * Inputs: rollNumber, name, email, deviceId
 */
function handleCheckIn(payload) {
  const rollNumber = (payload.rollNumber || "").toString().trim().toUpperCase();
  const name = (payload.name || "").toString().trim();
  const email = (payload.email || "").toString().trim();
  const deviceId = (payload.deviceId || "GATE_SCANNER").toString().trim();

  if (!rollNumber) {
    return createJsonResponse({
      status: "ERROR",
      message: "Roll Number is required for check-in."
    });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logsSheet = ss.getSheetByName(SHEET_ATTENDANCE_LOGS);

  if (!logsSheet) {
    return createJsonResponse({
      status: "ERROR",
      message: "Attendance_Logs sheet not found."
    });
  }

  const logsData = logsSheet.getDataRange().getValues();
  
  // Check for existing check-in entry
  for (let i = 1; i < logsData.length; i++) {
    const existingRoll = logsData[i][0].toString().trim().toUpperCase();
    if (existingRoll === rollNumber) {
      const prevTimestamp = logsData[i][3];
      return createJsonResponse({
        status: "DUPLICATE",
        message: "Student already checked in!",
        data: {
          roll: rollNumber,
          name: logsData[i][1] || name,
          email: logsData[i][2] || email,
          timestamp: prevTimestamp,
          deviceId: logsData[i][4] || ""
        }
      });
    }
  }

  // Append new check-in row
  const now = new Date().toISOString();
  logsSheet.appendRow([rollNumber, name, email, now, deviceId]);

  return createJsonResponse({
    status: "SUCCESS",
    message: "Check-in confirmed!",
    data: {
      roll: rollNumber,
      name: name,
      email: email,
      timestamp: now,
      deviceId: deviceId
    }
  });
}

/**
 * Helper: Output JSON response with proper headers for web app
 */
function createJsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
```

---

## 4. Deployment Instructions

1. Click **Deploy** > **New deployment** in the top-right corner of the Apps Script editor.
2. Click the gear icon (**Select type**) and choose **Web app**.
3. Configure settings:
   - **Description**: `Anti-Fraud Access Control API v1.0`
   - **Execute as**: `Me (your-email@gmail.com)`
   - **Who has access**: `Anyone` *(Crucial: allows frontend apps to connect via REST)*
4. Click **Deploy**.
5. Grant permissions if prompted by Google.
6. Copy the **Web App URL** (e.g. `https://script.google.com/macros/s/AKfycb.../exec`).
7. Paste this URL into your Next.js `.env.local` as `NEXT_PUBLIC_GAS_API_URL`.
