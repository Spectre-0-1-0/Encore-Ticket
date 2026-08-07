'use client';

import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { encryptPayload, StudentProfile } from '@/lib/cryptoEngine';
import { verifyStudent } from '@/lib/gasApi';
import { ShieldCheck, ShieldAlert, Download, QrCode, Lock, User, Mail, Hash, RefreshCw, EyeOff, CheckCircle2 } from 'lucide-react';
import html2canvas from 'html2canvas';

export default function StudentPortalPage() {
  const [rollNumber, setRollNumber] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [encryptedHex, setEncryptedHex] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const passRef = useRef<HTMLDivElement>(null);

  // Restore saved student entry pass from localStorage on mount (Prevents refresh logouts)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedSession = localStorage.getItem('EVENTQR_STUDENT_SESSION');
      if (savedSession) {
        const { profile, hex } = JSON.parse(savedSession);
        if (profile && hex) {
          setStudentProfile(profile);
          setEncryptedHex(hex);
        }
      }
    } catch (e) {
      console.warn('Could not restore saved student session:', e);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNumber.trim() || !email.trim()) {
      setErrorMessage('Please enter both Roll Number and Registered Email ID.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setStudentProfile(null);
    setEncryptedHex(null);

    try {
      const res = await verifyStudent(rollNumber, email);

      if (res.status === 'SUCCESS' && res.data) {
        // Fixed timestamp so the generated QR code is permanent and deterministic per student ID
        const profile: StudentProfile = {
          roll: res.data.roll,
          name: res.data.name,
          email: res.data.email,
          ts: 1767225600,
        };

        // Run Cryptographic Encryption
        const hex = encryptPayload(profile);

        setStudentProfile(profile);
        setEncryptedHex(hex);

        // Persist session on student device so ticket stays displayed
        try {
          localStorage.setItem('EVENTQR_STUDENT_SESSION', JSON.stringify({ profile, hex }));
        } catch (e) {
          console.warn('Could not save student session:', e);
        }
      } else {
        setErrorMessage(res.message || 'Access Denied: Submitted credentials were not found in the master participant list.');
      }
    } catch (err: any) {
      setErrorMessage('Verification failed: ' + (err.message || 'Network error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTicket = async () => {
    if (!passRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(passRef.current, {
        scale: 3, // High DPI export
        useCORS: true,
        backgroundColor: '#090d16',
      });

      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `ENcore_Event_Pass_${studentProfile?.roll || 'Ticket'}.png`;
      link.click();
    } catch (err) {
      console.error('Failed to download ticket image:', err);
      alert('Could not download pass. You can take a screenshot of your pass instead.');
    } finally {
      setDownloading(false);
    }
  };

  const handleReset = () => {
    try {
      localStorage.removeItem('EVENTQR_STUDENT_SESSION');
    } catch (e) {
      // ignore
    }
    setStudentProfile(null);
    setEncryptedHex(null);
    setErrorMessage(null);
    setRollNumber('');
    setEmail('');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 w-full">
      {/* Title & Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-700/50 text-cyan-300 text-xs font-semibold mb-3">
          <Lock className="w-3.5 h-3.5 text-cyan-400" />
          <span>ENcore Official Entry Pass</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
          ENcore Student Access Portal
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-lg mx-auto">
          Enter your registered student credentials to view your permanent event entry ticket.
        </p>
      </div>

      {!studentProfile ? (
        /* Identity Lookup Card */
        <div className="glass-panel rounded-2xl p-6 sm:p-8 max-w-md mx-auto shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-cyan-500" />

          <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
            <User className="w-5 h-5 text-cyan-400" />
            <span>Verify Student Credentials</span>
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Access is restricted to pre-authorized participants in the official Student Master database.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-cyan-400" /> Roll / Student ID Number
              </label>
              <input
                type="text"
                placeholder="e.g. 2024CS01"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-white rounded-xl px-4 py-3 text-sm transition outline-none font-mono tracking-wider"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-cyan-400" /> Registered Email Address
              </label>
              <input
                type="email"
                placeholder="e.g. student@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-white rounded-xl px-4 py-3 text-sm transition outline-none"
              />
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-800/80 text-red-200 text-xs flex items-start gap-2.5 animate-shake">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 transition duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <QrCode className="w-4 h-4" />
                  <span>Access Event Pass</span>
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        /* Verified Ticket View */
        <div className="space-y-6 max-w-lg mx-auto">
          {/* Action Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Identity Verified & Ticket Issued</span>
            </div>
            <button
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-white underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Log Out
            </button>
          </div>

          {/* Ticket Card Container for Export */}
          <div
            ref={passRef}
            className="glass-panel rounded-3xl p-6 sm:p-8 text-center border border-cyan-500/30 shadow-2xl relative overflow-hidden bg-slate-950"
          >
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />

            {/* Ticket Header Badge */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
              <div className="text-left">
                <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400">OFFICIAL ACCESS PASS</span>
                <h3 className="text-base font-extrabold text-white">ENcore Event 2026</h3>
              </div>
              <div className="px-2.5 py-1 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-700/50 text-[11px] font-semibold font-mono">
                PASS VALID
              </div>
            </div>

            {/* Encrypted QR Rendering */}
            <div className="my-6 flex flex-col items-center">
              <div className="p-4 bg-white rounded-2xl shadow-xl shadow-cyan-500/10 border-4 border-cyan-500/40 inline-block relative">
                {encryptedHex && (
                  <QRCodeSVG
                    value={encryptedHex}
                    size={220}
                    level="H"
                    includeMargin={false}
                    fgColor="#090d16"
                    bgColor="#ffffff"
                  />
                )}
              </div>
              <span className="text-[11px] font-mono text-cyan-400/80 mt-3 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Permanent ENcore Pass QR
              </span>
            </div>

            {/* Student Information Details */}
            <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 text-left space-y-2 mb-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Participant Name:</span>
                <span className="font-bold text-white">{studentProfile.name}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Roll Number:</span>
                <span className="font-mono font-bold text-cyan-400">{studentProfile.roll}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Registered Email:</span>
                <span className="font-mono text-slate-300 text-[11px]">{studentProfile.email}</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 tracking-tight">
              Present this QR ticket at gate entrance. Authorized Admin Scanner will verify entry.
            </p>
          </div>

          {/* Download & Save Buttons */}
          <button
            onClick={handleDownloadTicket}
            disabled={downloading}
            className="w-full py-3.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-600/30 transition flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'Preparing Pass Download...' : 'Download Event Pass (PNG)'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
