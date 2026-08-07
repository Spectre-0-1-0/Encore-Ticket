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

const GAS_API_URL = process.env.NEXT_PUBLIC_GAS_API_URL || '';

function isPlaceholderUrl(url: string): boolean {
  return !url || url.includes('AKfycbx_EXAMPLE_SCRIPT_ID') || !url.startsWith('https://script.google.com');
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
 * Save new Master Database records to localStorage
 */
export function saveMasterDatabase(records: StudentRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('EVENTQR_MASTER_DB', JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save Master DB to localStorage', e);
  }
}

/**
 * Verify Student credentials against Student_Master database
 */
export async function verifyStudent(rollNumber: string, email: string): Promise<VerifyResponse> {
  const cleanRoll = rollNumber.trim().toUpperCase();
  const cleanEmail = email.trim().toLowerCase();

  if (isPlaceholderUrl(GAS_API_URL)) {
    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate network latency

    const masterDb = getMasterDatabase();
    const match = masterDb.find(
      (s) => s.roll.trim().toUpperCase() === cleanRoll && s.email.trim().toLowerCase() === cleanEmail
    );

    if (match) {
      return {
        status: 'SUCCESS',
        data: {
          roll: match.roll.trim().toUpperCase(),
          name: match.name.trim(),
          email: match.email.trim().toLowerCase(),
        },
      };
    } else {
      return {
        status: 'DENIED',
        message: 'Access Denied: Submitted credentials were not found in the master participant list.',
      };
    }
  }

  try {
    const response = await fetch(GAS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // Apps Script CORS requirement
      },
      body: JSON.stringify({
        action: 'verify_student',
        rollNumber: cleanRoll,
        email: cleanEmail,
      }),
    });

    const data: VerifyResponse = await response.json();
    return data;
  } catch (err: any) {
    console.error('GAS Verification Fetch Error:', err);
    // Fallback to local master database lookup if API fetch fails or CORS issue
    const masterDb = getMasterDatabase();
    const match = masterDb.find(
      (s) => s.roll.trim().toUpperCase() === cleanRoll && s.email.trim().toLowerCase() === cleanEmail
    );

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
  if (isPlaceholderUrl(GAS_API_URL)) {
    console.warn('GAS_API_URL is placeholder or missing. Using mock attendance logger for testing.');
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
    const response = await fetch(GAS_API_URL, {
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
    console.error('GAS Check-in Fetch Error:', err);
    return {
      status: 'ERROR',
      message: 'Failed to record check-in on backend: ' + err.message,
    };
  }
}
