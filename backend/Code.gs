/**
 * Anti-Fraud Event Access Control System - Google Apps Script REST API
 * Version: 1.0.0
 * 
 * Deployment Instructions:
 * 1. Open your Google Sheet (with tabs: "Student_Master" and "Attendance_Logs").
 * 2. Click Extensions > Apps Script.
 * 3. Paste this code into Code.gs.
 * 4. Click Deploy > New deployment > Web app.
 * 5. Set Execute as: "Me", Who has access: "Anyone".
 * 6. Copy the Web App URL into .env.local as NEXT_PUBLIC_GAS_API_URL.
 */

const SHEET_STUDENT_MASTER = "Student_Master";
const SHEET_ATTENDANCE_LOGS = "Attendance_Logs";

function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // 10-second concurrency lock
  } catch (err) {
    return createJsonResponse({
      status: "ERROR",
      message: "Server busy. Please try scanning again."
    });
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
    } else if (action === "upload_master") {
      return handleUploadMaster(payload);
    } else if (action === "ping") {
      return createJsonResponse({ status: "SUCCESS", message: "API active" });
    } else {
      return createJsonResponse({
        status: "ERROR",
        message: "Invalid API action specified."
      });
    }
  } catch (error) {
    return createJsonResponse({
      status: "ERROR",
      message: "Server exception: " + error.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

function handleVerifyStudent(payload) {
  const rollNumber = (payload.rollNumber || "").toString().trim().toUpperCase();
  const email = (payload.email || "").toString().trim().toLowerCase();

  if (!rollNumber) {
    return createJsonResponse({
      status: "ERROR",
      message: "Roll Number is required."
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

  const cleanRoll = rollNumber.replace(/[^A-Z0-9]/g, "");
  const emailUsername = email.split('@')[0];

  const data = masterSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const rowRoll = data[i][0].toString().trim().toUpperCase();
    const cleanRowRoll = rowRoll.replace(/[^A-Z0-9]/g, "");
    const rowEmail = data[i][2].toString().trim().toLowerCase();
    const rowEmailUsername = rowEmail.split('@')[0];

    if (cleanRowRoll === cleanRoll && (rowEmail === email || rowEmailUsername === emailUsername || !email)) {
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

function handleUploadMaster(payload) {
  const records = payload.records || [];
  if (!Array.isArray(records) || records.length === 0) {
    return createJsonResponse({
      status: "ERROR",
      message: "No valid student records provided."
    });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let masterSheet = ss.getSheetByName(SHEET_STUDENT_MASTER);

  if (!masterSheet) {
    masterSheet = ss.insertSheet(SHEET_STUDENT_MASTER);
    masterSheet.appendRow(["Roll_Number", "Student_Name", "Email_Address", "Account_Created"]);
  } else {
    masterSheet.clearContents();
    masterSheet.appendRow(["Roll_Number", "Student_Name", "Email_Address", "Account_Created"]);
  }

  const rows = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    rows.push([r.roll || "", r.name || "", r.email || "", false]);
  }

  if (rows.length > 0) {
    masterSheet.getRange(2, 1, rows.length, 4).setValues(rows);
  }

  return createJsonResponse({
    status: "SUCCESS",
    message: "Master Database updated with " + rows.length + " records."
  });
}

function createJsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
