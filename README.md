# 🎟️ Anti-Fraud Event Access Control & QR Verification System

> **A privacy-first, zero-trust event ticketing and real-time attendance management platform powered by multi-layer cryptographic QR obfuscation and a serverless Google Workspace backend.**

---

## 📌 Executive Summary

Modern event entry systems often expose Personally Identifiable Information (PII) like names, email addresses, phone numbers, or registration IDs directly inside standard QR codes. Anyone with a smartphone camera can scan these tickets to extract student data or synthesize fraudulent duplicate tickets.

This platform solves this vulnerability through **Asymmetric Visibility**:
- **Public / Standard Cameras**: Scanning the ticket with Google Lens, iOS Camera, or generic barcode scanners yields an indecipherable, non-functional raw Hexadecimal string (e.g., `584F523A...`). No links, text, or contact cards are exposed.
- **Authorized Admin Scanner App**: Instantly reverses the multi-layer cipher (Hex → XOR Bitmask → Triple-DES → AES-256 → HMAC SHA-256 checksum), verifies payload integrity, queries the Google Sheets backend in real time, and triggers immediate visual and auditory entry notifications while flagging duplicate check-in attempts.

---

## 🚀 Key Features

- **🔐 4-Layer Cryptographic Pipeline**: HMAC-SHA256 integrity signature + AES-256-CBC + Triple-DES-CBC + Custom Bitwise XOR Byte Shift + Upper Hexadecimal Encoding.
- **📱 Zero-PII Public Exposure**: Ticket payloads look like random noise to standard scanners.
- **⚡ Zero Database Hosting Cost**: Leverages Google Sheets + Google Apps Script V8 Serverless Web App API as a cloud database and backend.
- **🚫 Real-Time Anti-Passback & Fraud Prevention**: Server-side duplicate validation prevents ticket reuse or screenshot sharing across gates.
- **📷 High-Speed WebRTC Camera Decoding**: Built with `html5-qrcode` for instant frame processing on mobile browsers without native app installation.
- **🔊 Auditory & Visual Feedback System**: Web Audio API tones + high-contrast UI cards (Green = Confirmed, Amber/Red = Duplicate Attempt, Dark Red = Invalid/Tampered).
- **📥 Offline Pass Storage**: Export ticket as high-resolution PNG or printable PDF pass with human-readable verification badge.

---

## 🏗️ System Architecture Overview

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

## 🗂️ Documentation Structure

Complete documentation is available in the [`docs/`](./docs/) directory:

- 📖 [**`docs/ARCHITECTURE.md`**](./docs/ARCHITECTURE.md) – Comprehensive system architecture, strategic security pillars, threat vectors, and component interaction flows.
- 🔐 [**`docs/CRYPTO_SPECIFICATION.md`**](./docs/CRYPTO_SPECIFICATION.md) – Detailed mathematical and algorithmic specification of the 4-layer cryptographic pipeline and reverse decryption process.
- ⚡ [**`docs/GOOGLE_APPS_SCRIPT_SETUP.md`**](./docs/GOOGLE_APPS_SCRIPT_SETUP.md) – Complete guide to deploying the serverless Google Sheets backend API along with production-grade `Code.gs` script.
- 📊 [**`docs/DATA_SCHEMAS.md`**](./docs/DATA_SCHEMAS.md) – Complete data models for `Student_Master`, `Attendance_Logs`, JSON payloads, and REST API contract endpoints.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | Next.js 14 (App Router) / React / Tailwind CSS | Fast responsive UI, PWA capabilities, high performance |
| **Backend & DB** | Google Sheets + Google Apps Script | Serverless REST API, zero database hosting cost |
| **Cryptographic Core** | CryptoJS v4.x + Native Bitwise Operators | AES-256, Triple-DES, HMAC-SHA256, XOR Array Shifting |
| **Camera Decoder** | `html5-qrcode` | WebRTC camera stream reader for mobile web browsers |
| **QR Generator** | `qrcode.react` / `qrcode` | High-density SVG/Canvas vector QR code generator |
| **Sound Engine** | HTML5 Web Audio API | Synthesizes real-time success, warning, and error frequencies |

---

## ⚡ Quick Start Guide

### Prerequisites
- Node.js 18.x or higher
- npm / pnpm / yarn
- A Google account to host the Google Sheet & Apps Script API

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/eventqr.git
   cd eventqr
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) for the Student Portal and [http://localhost:3000/admin](http://localhost:3000/admin) for the Admin Control & Scanner App.

---

## 📄 License

This project is released under the **MIT License**.
