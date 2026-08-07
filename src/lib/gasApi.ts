export interface VerifyResponse {
  status: 'SUCCESS' | 'DENIED' | 'ERROR';
  message?: string;
  data?: {
    roll: string;
    name: string;
    email: string;
  };
}

export interface CheckInResponse {
  status: 'SUCCESS' | 'DUPLICATE' | 'ERROR';
  message?: string;
  data?: {
    roll: string;
    name: string;
    email: string;
    timestamp: string;
    deviceId: string;
  };
}

export interface StudentRecord {
  roll: string;
  name: string;
  email: string;
}

const DEFAULT_MASTER_DB: StudentRecord[] = [
  { roll: '2024CS01', name: 'Pavan Kandala', email: 'pavan@example.com' },
  { roll: '2024CS02', name: 'Alex Johnson', email: 'alex@example.com' },
  { roll: '2024EE05', name: 'Sophia Smith', email: 'sophia@example.com' },
  { roll: '2024ME12', name: 'Rahul Verma', email: 'rahul@example.com' },
];

/**
 * Get active Google Apps Script Webhook API URL from localStorage or env
 */
export function getGasApiUrl(): string {
  if (typeof window !== 'undefined') {
    const savedUrl = localStorage.getItem('EVENTQR_GAS_API_URL');
    if (savedUrl && savedUrl.trim().startsWith('https://script.google.com')) {
      return savedUrl.trim();
    }
  }
  return process.env.NEXT_PUBLIC_GAS_API_URL || '';
}

/**
 * Save custom Google Apps Script Webhook API URL
 */
export function setGasApiUrl(url: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('EVENTQR_GAS_API_URL', url.trim());
}

function isPlaceholderUrl(url: string): boolean {
  if (!url || !url.trim()) return true;
  const clean = url.trim();
  return (
    clean.includes('AKfycbx_EXAMPLE_SCRIPT_ID') ||
    clean.includes('YOUR_SCRIPT_ID') ||
    !clean.startsWith('https://script.google.com')
  );
}

/**
 * Get current Master Database records from localStorage or defaults
 */
export function getMasterDatabase(): StudentRecord[] {
  if (typeof window === 'undefined') return DEFAULT_MASTER_DB;
  try {
    const stored = localStorage.getItem('EVENTQR_MASTER_DB');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read Master DB from localStorage', e);
  }
  return DEFAULT_MASTER_DB;
}

/**
 * Save new Master Database records to localStorage and sync to GAS backend if connected
 */
export async function saveMasterDatabase(records: StudentRecord[]): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('EVENTQR_MASTER_DB', JSON.stringify(records));
    } catch (e) {
      console.error('Failed to save Master DB to localStorage', e);
    }
  }

  const apiUrl = getGasApiUrl();
  if (!isPlaceholderUrl(apiUrl)) {
    try {
      await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'upload_master',
          records: records,
        }),
      });
    } catch (err) {
      console.warn('Failed to sync master database to Google Sheets backend:', err);
    }
  }
}

/**
 * Verify Student credentials against Student_Master database (GAS API & Local Storage)
 */
export async function verifyStudent(rollNumber: string, email: string): Promise<VerifyResponse> {
  const cleanRoll = rollNumber.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const cleanEmail = email.trim().toLowerCase();
  const apiUrl = getGasApiUrl();

  // Try Google Apps Script API first if configured
  if (!isPlaceholderUrl(apiUrl)) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'verify_student',
          rollNumber: rollNumber.trim().toUpperCase(),
          email: cleanEmail,
        }),
      });

      const data: VerifyResponse = await response.json();
      if (data.status === 'SUCCESS' && data.data) {
        return data;
      }
    } catch (err: any) {
      console.warn('GAS Verification API Error, falling back to local database:', err);
    }
  }

  // Fall back to Local Master Database (uploaded Excel / CSV records)
  const masterDb = getMasterDatabase();
  const match = masterDb.find((s) => {
    const dbRoll = s.roll.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const dbEmail = s.email.trim().toLowerCase();

    const rollMatches = dbRoll === cleanRoll || s.roll.trim().toUpperCase() === rollNumber.trim().toUpperCase();
    const emailMatches =
      dbEmail === cleanEmail ||
      dbEmail.split('@')[0] === cleanEmail.split('@')[0] ||
      !cleanEmail ||
      cleanEmail.length === 0;

    return rollMatches && emailMatches;
  });

  if (match) {
    return {
      status: 'SUCCESS',
      data: {
        roll: match.roll.trim().toUpperCase(),
        name: match.name.trim(),
        email: match.email.trim().toLowerCase(),
      },
    };
  }

  return {
    status: 'DENIED',
    message: 'Access Denied: Submitted credentials were not found in the master participant list.',
  };
}

// In-memory mock check-in log for testing mode
const mockAttendanceLogs = new Map<string, { name: string; email: string; timestamp: string; deviceId: string }>();

/**
 * Gate Check-in Validation & Attendance Logging against Attendance_Logs sheet
 */
export async function checkInStudent(
  rollNumber: string,
  name: string,
  email: string,
  deviceId: string = 'GATE_SCANNER_01'
): Promise<CheckInResponse> {
  const apiUrl = getGasApiUrl();

  if (isPlaceholderUrl(apiUrl)) {
    await new Promise((resolve) => setTimeout(resolve, 600));

    const cleanRoll = rollNumber.trim().toUpperCase();

    if (mockAttendanceLogs.has(cleanRoll)) {
      const existing = mockAttendanceLogs.get(cleanRoll)!;
      return {
        status: 'DUPLICATE',
        message: `WARNING: Duplicate Entry! ${existing.name} (${cleanRoll}) already checked in!`,
        data: {
          roll: cleanRoll,
          name: existing.name,
          email: existing.email,
          timestamp: existing.timestamp,
          deviceId: existing.deviceId,
        },
      };
    }

    const now = new Date().toISOString();
    const newEntry = { name, email, timestamp: now, deviceId };
    mockAttendanceLogs.set(cleanRoll, newEntry);

    return {
      status: 'SUCCESS',
      message: 'CHECK-IN CONFIRMED',
      data: {
        roll: cleanRoll,
        name: name,
        email: email,
        timestamp: now,
        deviceId: deviceId,
      },
    };
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'check_in',
        rollNumber: rollNumber,
        name: name,
        email: email,
        deviceId: deviceId,
      }),
    });

    const data: CheckInResponse = await response.json();
    return data;
  } catch (err: any) {
    console.warn('GAS Check-in Fetch Error, using local attendance logger:', err);
    const cleanRoll = rollNumber.trim().toUpperCase();

    if (mockAttendanceLogs.has(cleanRoll)) {
      const existing = mockAttendanceLogs.get(cleanRoll)!;
      return {
        status: 'DUPLICATE',
        message: `WARNING: Duplicate Entry! ${existing.name} (${cleanRoll}) already checked in!`,
        data: {
          roll: cleanRoll,
          name: existing.name,
          email: existing.email,
          timestamp: existing.timestamp,
          deviceId: existing.deviceId,
        },
      };
    }

    const now = new Date().toISOString();
    const newEntry = { name, email, timestamp: now, deviceId };
    mockAttendanceLogs.set(cleanRoll, newEntry);

    return {
      status: 'SUCCESS',
      message: 'CHECK-IN CONFIRMED',
      data: {
        roll: cleanRoll,
        name: name,
        email: email,
        timestamp: now,
        deviceId: deviceId,
      },
    };
  }
}
