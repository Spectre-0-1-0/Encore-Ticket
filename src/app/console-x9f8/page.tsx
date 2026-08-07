'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { decryptPayload, StudentProfile } from '@/lib/cryptoEngine';
import { checkInStudent, CheckInResponse, getMasterDatabase, saveMasterDatabase, StudentRecord } from '@/lib/gasApi';
import { soundEngine } from '@/lib/audioEngine';
import {
  ShieldAlert,
  Lock,
  Camera,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Volume2,
  VolumeX,
  Search,
  Users,
  RefreshCw,
  ArrowLeft,
  Upload,
  Database,
  FileSpreadsheet,
  Check,
  ShieldCheck,
  LogOut,
  Download,
  Trash2,
} from 'lucide-react';

type ScanStatus = 'IDLE' | 'SCANNING' | 'PROCESSING' | 'SUCCESS' | 'DUPLICATE' | 'INVALID';
type UserRole = 'NONE' | 'ADMIN' | 'SUPERADMIN';
type AdminTab = 'SCANNER' | 'MASTER_DB';

export default function ObscuredAdminConsolePage() {
  // Passcode Auth & Role State
  const [role, setRole] = useState<UserRole>('NONE');
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState(false);

  // Tab Navigation State
  const [activeTab, setActiveTab] = useState<AdminTab>('SCANNER');

  // Scanner & Processing State
  const [status, setStatus] = useState<ScanStatus>('IDLE');
  const [scannedResult, setScannedResult] = useState<CheckInResponse | null>(null);
  const [decryptedStudent, setDecryptedStudent] = useState<StudentProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Manual Roll Fallback Search
  const [manualRoll, setManualRoll] = useState('');

  // Gate Statistics Counter
  const [checkInCount, setCheckInCount] = useState(0);

  // Master Database Upload State (Superadmin)
  const [masterRecords, setMasterRecords] = useState<StudentRecord[]>([]);
  const [csvInputText, setCsvInputText] = useState('');
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);

  // Camera Reader Ref
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'html5-qr-reader';
  const isScanningRef = useRef(false);

  const EXPECTED_ADMIN_PASSCODE = process.env.NEXT_PUBLIC_ADMIN_PASSCODE || 'admin123';
  const EXPECTED_SUPERADMIN_PASSCODE = process.env.NEXT_PUBLIC_SUPERADMIN_PASSCODE || 'superadmin2026';

  // Load initial Master Database records on mount
  useEffect(() => {
    setMasterRecords(getMasterDatabase());
  }, []);

  // Handle Passcode Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPass = passcode.trim();

    if (cleanPass === EXPECTED_SUPERADMIN_PASSCODE) {
      setRole('SUPERADMIN');
      setAuthError(false);
    } else if (cleanPass === EXPECTED_ADMIN_PASSCODE) {
      setRole('ADMIN');
      setActiveTab('SCANNER'); // Admins only get scanner tab
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  };

  const handleLogout = () => {
    setRole('NONE');
    setPasscode('');
    setStatus('IDLE');
  };

  // Start Camera Scanning
  useEffect(() => {
    if (role === 'NONE' || activeTab !== 'SCANNER') return;

    let html5Qrcode: Html5Qrcode;

    const startScanner = async () => {
      try {
        html5Qrcode = new Html5Qrcode(scannerContainerId);
        scannerRef.current = html5Qrcode;

        const config = {
          fps: 10,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        };

        await html5Qrcode.start(
          { facingMode: 'environment' }, // Rear mobile camera
          config,
          onScanSuccess,
          onScanFailure
        );

        isScanningRef.current = true;
        setStatus('SCANNING');
      } catch (err) {
        console.error('Camera Access Error:', err);
        setErrorMessage('Camera access permission denied or no camera device found.');
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current && isScanningRef.current) {
        scannerRef.current
          .stop()
          .catch((err) => console.warn('Error stopping scanner:', err))
          .finally(() => {
            isScanningRef.current = false;
          });
      }
    };
  }, [role, activeTab]);

  // Callback when a QR frame is captured by html5-qrcode
  const onScanSuccess = async (decodedText: string) => {
    if (isScanningRef.current) {
      if (scannerRef.current) {
        try {
          await scannerRef.current.pause(true);
        } catch (e) {
          // ignore pause error
        }
      }
      handleProcessPayload(decodedText);
    }
  };

  const onScanFailure = (error: any) => {
    // Silent ignore frame decode misses
  };

  // Process and Decrypt Hex Payload
  const handleProcessPayload = async (hexText: string, studentName?: string, studentEmail?: string) => {
    setStatus('PROCESSING');
    setErrorMessage(null);
    setScannedResult(null);
    setDecryptedStudent(null);

    let profile: StudentProfile | null = null;

    try {
      if (!studentName) {
        profile = decryptPayload(hexText);
        setDecryptedStudent(profile);
      } else {
        profile = {
          roll: hexText.toUpperCase(),
          name: studentName,
          email: studentEmail || '',
          ts: Math.floor(Date.now() / 1000),
        };
      }

      const res = await checkInStudent(profile.roll, profile.name, profile.email, 'ADMIN_GATE_01');
      setScannedResult(res);

      if (res.status === 'SUCCESS') {
        setStatus('SUCCESS');
        setCheckInCount((prev) => prev + 1);
        if (audioEnabled) soundEngine.playSuccess();
      } else if (res.status === 'DUPLICATE') {
        setStatus('DUPLICATE');
        if (audioEnabled) soundEngine.playWarning();
      } else {
        setStatus('INVALID');
        setErrorMessage(res.message || 'Server error verifying check-in state.');
        if (audioEnabled) soundEngine.playError();
      }
    } catch (err: any) {
      console.error('Decryption / Verification Exception:', err);
      setStatus('INVALID');
      setErrorMessage(err.message || 'UNAUTHORIZED TICKET: Decryption failed.');
      if (audioEnabled) soundEngine.playError();
    }
  };

  // Resume Camera Scanning after displaying result alert
  const handleResumeScanning = async () => {
    setStatus('SCANNING');
    setScannedResult(null);
    setDecryptedStudent(null);
    setErrorMessage(null);
    setManualRoll('');

    if (scannerRef.current) {
      try {
        await scannerRef.current.resume();
      } catch (e) {
        console.warn('Error resuming scanner:', e);
      }
    }
  };

  // Manual Roll Fallback Submit
  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualRoll.trim()) return;
    handleProcessPayload(manualRoll.trim().toUpperCase(), 'Manual Gate Search', 'manual@event.com');
  };

  // Dynamic XLSX Loader
  const getXLSX = async (): Promise<any> => {
    if (typeof window !== 'undefined' && (window as any).XLSX) {
      return (window as any).XLSX;
    }
    try {
      // @ts-ignore
      const XLSX = await import('xlsx');
      return XLSX;
    } catch (e) {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        script.onload = () => resolve((window as any).XLSX);
        script.onerror = (err) => reject(new Error('Failed to load Excel parser library.'));
        document.head.appendChild(script);
      });
    }
  };

  // Parse CSV helper function
  const parseCSVContent = (text: string): StudentRecord[] => {
    const lines = text.split(/\r?\n/);
    const parsed: StudentRecord[] = [];

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      if (line.toLowerCase().includes('roll') && line.toLowerCase().includes('email')) continue;

      const parts = line.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= 3) {
        parsed.push({
          roll: parts[0].toUpperCase(),
          name: parts[1],
          email: parts[2].toLowerCase(),
        });
      } else if (parts.length === 2) {
        parsed.push({
          roll: parts[0].toUpperCase(),
          name: parts[0],
          email: parts[1].toLowerCase(),
        });
      }
    }
    return parsed;
  };

  // Handle CSV & Excel File Upload (Superadmin Only)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadSuccessMsg(null);
    setUploadErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      let parsedRecords: StudentRecord[] = [];

      if (isExcel) {
        const XLSX = await getXLSX();
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        for (const row of rows) {
          if (!row || row.length === 0) continue;
          const rStr = row.map((cell) => String(cell || '').trim());
          if (rStr.some((c) => c.toLowerCase().includes('roll') && c.toLowerCase().includes('email'))) continue;

          if (rStr.length >= 3) {
            parsedRecords.push({
              roll: rStr[0].toUpperCase(),
              name: rStr[1],
              email: rStr[2].toLowerCase(),
            });
          } else if (rStr.length === 2) {
            parsedRecords.push({
              roll: rStr[0].toUpperCase(),
              name: rStr[0],
              email: rStr[1].toLowerCase(),
            });
          }
        }
      } else {
        const text = await file.text();
        parsedRecords = parseCSVContent(text);
      }

      if (parsedRecords.length === 0) {
        setUploadErrorMsg('Could not parse any valid student records from file. Required columns: Roll Number, Name, Email');
        return;
      }

      saveMasterDatabase(parsedRecords);
      setMasterRecords(parsedRecords);
      setUploadSuccessMsg(`Successfully uploaded and saved ${parsedRecords.length} student records from "${file.name}"!`);
    } catch (err: any) {
      console.error('File parsing error:', err);
      setUploadErrorMsg('Failed to process file: ' + (err.message || 'Invalid format'));
    }
  };

  // Handle Paste CSV Submit (Superadmin Only)
  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUploadSuccessMsg(null);
    setUploadErrorMsg(null);

    if (!csvInputText.trim()) {
      setUploadErrorMsg('Please paste CSV text before submitting.');
      return;
    }

    const newRecords = parseCSVContent(csvInputText);
    if (newRecords.length === 0) {
      setUploadErrorMsg('Could not parse any valid student records. Format: Roll, Name, Email');
      return;
    }

    saveMasterDatabase(newRecords);
    setMasterRecords(newRecords);
    setCsvInputText('');
    setUploadSuccessMsg(`Successfully saved ${newRecords.length} student records to Master Database!`);
  };

  if (role === 'NONE') {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="glass-panel rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-cyan-500/20">
          <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-700/50 flex items-center justify-center mx-auto mb-4 text-cyan-400">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-center text-white mb-1">ENcore Staff Portal</h2>
          <p className="text-xs text-center text-slate-400 mb-6">Enter Admin or Superadmin passcode to authenticate.</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 text-white rounded-xl px-4 py-3 text-sm text-center tracking-widest outline-none font-mono"
              />
              {authError && <p className="text-xs text-red-400 text-center mt-2 font-medium">Incorrect Passcode. Try again.</p>}
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm transition shadow-lg shadow-cyan-600/30"
            >
              Unlock Security Console
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-500 text-center space-y-1">
            <p>🔑 <strong className="text-slate-400">Admin Passcode:</strong> Gate Scanner Access</p>
            <p>👑 <strong className="text-cyan-400">Superadmin Passcode:</strong> Full Master Control</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 w-full flex-1 flex flex-col">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <a href="/" className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white" title="Student View">
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-bold text-white leading-tight">ENcore Console</h1>
              {role === 'SUPERADMIN' ? (
                <span className="px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-bold">
                  👑 SUPERADMIN
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-bold">
                  🛡️ ADMIN
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-mono">GATE #1 • Security Active</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('SCANNER')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'SCANNER'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" /> Scanner
          </button>

          {role === 'SUPERADMIN' && (
            <button
              onClick={() => setActiveTab('MASTER_DB')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'MASTER_DB'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5" /> Master Sheet
            </button>
          )}

          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 transition"
            title="Log Out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {activeTab === 'SCANNER' ? (
        <>
          {/* Main Scanner Container & Result Overlay */}
          <div className="relative glass-panel rounded-3xl overflow-hidden shadow-2xl border border-slate-800 mb-6">
            <div className="relative min-h-[320px] bg-slate-950 flex items-center justify-center overflow-hidden">
              <div id={scannerContainerId} className="w-full h-full" />

              {status === 'SCANNING' && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-64 h-64 border-2 border-cyan-400/40 rounded-2xl relative">
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-cyan-400 rounded-br-lg" />
                    <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-cyan-500 via-indigo-400 to-cyan-500 shadow-[0_0_12px_#06b6d4] animate-scan-line" />
                  </div>
                </div>
              )}

              {status !== 'SCANNING' && status !== 'IDLE' && (
                <div className="absolute inset-0 z-20 backdrop-blur-md bg-slate-950/90 p-6 flex flex-col items-center justify-center text-center animate-fade-in">
                  {status === 'PROCESSING' && (
                    <div className="space-y-3">
                      <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin mx-auto" />
                      <p className="text-sm font-semibold text-white">Verifying Student Ticket...</p>
                    </div>
                  )}

                  {/* SUCCESS RESULT CARD */}
                  {status === 'SUCCESS' && (
                    <div className="space-y-4 w-full">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400 animate-bounce">
                        <CheckCircle className="w-10 h-10" />
                      </div>
                      <div>
                        <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-bold uppercase tracking-wider">
                          ✅ CHECK-IN CONFIRMED
                        </span>
                        <h2 className="text-2xl font-extrabold text-white mt-2">
                          {scannedResult?.data?.name || decryptedStudent?.name}
                        </h2>
                        <p className="text-sm font-mono text-cyan-400 font-bold">
                          Roll: {scannedResult?.data?.roll || decryptedStudent?.roll}
                        </p>
                      </div>

                      <button
                        onClick={handleResumeScanning}
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition"
                      >
                        Scan Next Ticket
                      </button>
                    </div>
                  )}

                  {/* DUPLICATE RESULT CARD */}
                  {status === 'DUPLICATE' && (
                    <div className="space-y-4 w-full">
                      <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center mx-auto text-amber-400 animate-pulse">
                        <AlertTriangle className="w-10 h-10" />
                      </div>
                      <div>
                        <span className="px-3 py-1 rounded-full bg-amber-950 text-amber-400 border border-amber-800 text-xs font-bold uppercase tracking-wider">
                          ⚠️ WARNING: DUPLICATE ENTRY!
                        </span>
                        <h2 className="text-xl font-extrabold text-white mt-2">
                          {scannedResult?.data?.name || decryptedStudent?.name} ({scannedResult?.data?.roll})
                        </h2>
                        <div className="mt-3 p-2 bg-red-950/80 border border-red-800 rounded-lg text-red-300 font-bold text-xs">
                          ⛔ ACTION REQUIRED: DO NOT ALLOW ENTRY
                        </div>
                      </div>

                      <button
                        onClick={handleResumeScanning}
                        className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-600/30 transition"
                      >
                        Dismiss Warning & Resume Scan
                      </button>
                    </div>
                  )}

                  {/* INVALID TICKET CARD */}
                  {status === 'INVALID' && (
                    <div className="space-y-4 w-full">
                      <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mx-auto text-red-400">
                        <XCircle className="w-10 h-10" />
                      </div>
                      <div>
                        <span className="px-3 py-1 rounded-full bg-red-950 text-red-400 border border-red-800 text-xs font-bold uppercase tracking-wider">
                          🛑 INVALID / UNRECOGNIZED TICKET
                        </span>
                        <p className="text-sm font-semibold text-white mt-2">{errorMessage}</p>
                      </div>

                      <button
                        onClick={handleResumeScanning}
                        className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition"
                      >
                        Try Scanning Again
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Manual Roll Number Search Fallback */}
          <div className="glass-card rounded-2xl p-4 border border-slate-800">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-cyan-400" /> Manual Gate Search
            </h3>
            <form onSubmit={handleManualSearch} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Roll Number (e.g. 2024CS01)"
                value={manualRoll}
                onChange={(e) => setManualRoll(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-xs font-mono outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs transition shrink-0"
              >
                Check In
              </button>
            </form>
          </div>
        </>
      ) : (
        /* MASTER SHEET DATABASE UPLOAD TAB (Superadmin Only) */
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl p-6 border border-purple-500/20 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-purple-400" /> Superadmin Master Database Management
                </h2>
                <p className="text-xs text-slate-400">
                  Upload Excel (.xlsx, .xls) or CSV files to configure authorized participants.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-purple-950 border border-purple-800 text-purple-300 text-xs font-mono font-bold">
                {masterRecords.length} Records
              </span>
            </div>

            {uploadSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{uploadSuccessMsg}</span>
              </div>
            )}

            {uploadErrorMsg && (
              <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                <span>{uploadErrorMsg}</span>
              </div>
            )}

            {/* Option A: CSV or Excel File Picker */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Option 1: Choose Excel or CSV File (.xlsx, .xls, .csv)
              </label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                onChange={handleFileUpload}
                className="w-full text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-950 file:text-purple-300 hover:file:bg-purple-900 border border-slate-800 rounded-xl p-1 bg-slate-900 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-1">Columns: Roll Number, Name, Email</p>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-3 text-slate-400 text-xs font-semibold uppercase">OR</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            {/* Option B: Paste CSV Textarea */}
            <form onSubmit={handlePasteSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Option 2: Paste CSV Student Records
                </label>
                <textarea
                  rows={4}
                  placeholder={`2024CS01, Pavan Kandala, pavan@example.com\n2024CS02, Alex Johnson, alex@example.com\n2024EE05, Sophia Smith, sophia@example.com`}
                  value={csvInputText}
                  onChange={(e) => setCsvInputText(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-3 text-xs font-mono outline-none focus:border-purple-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" /> Save & Update Master Database
              </button>
            </form>
          </div>

          {/* Current Master Database Preview */}
          <div className="glass-panel rounded-2xl p-5 border border-slate-800">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-purple-400" /> Active Student Master Database ({masterRecords.length})
            </h3>

            <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="p-2.5 font-semibold">Roll No</th>
                    <th className="p-2.5 font-semibold">Name</th>
                    <th className="p-2.5 font-semibold">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {masterRecords.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-900/50">
                      <td className="p-2.5 text-cyan-400 font-bold">{r.roll}</td>
                      <td className="p-2.5 text-white font-sans font-medium">{r.name}</td>
                      <td className="p-2.5 text-slate-400 text-[11px]">{r.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
