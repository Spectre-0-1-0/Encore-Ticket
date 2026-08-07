import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ENcore Anti-Fraud Event Access & Ticket Pass',
  description:
    'Privacy-first event ticketing and real-time attendance management platform with encrypted QR access control.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ENcore Pass',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  themeColor: '#06b6d4',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans antialiased">
        <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 font-bold text-white text-xl">
                🛡️
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent">
                  ENcore <span className="text-cyan-400">QR</span>
                </span>
              </div>
            </div>

            <nav className="flex items-center gap-4">
              <a
                href="/"
                className="text-xs sm:text-sm font-medium px-3 py-1.5 rounded-lg bg-slate-800/60 text-slate-300 hover:text-white hover:bg-slate-800 transition"
              >
                🎓 Student Portal
              </a>
            </nav>
          </div>
        </header>

        <main className="flex-1 flex flex-col">{children}</main>

        <footer className="border-t border-slate-800/60 py-6 text-center text-xs text-slate-500 bg-slate-950">
          <p>© 2026 ENcore Event Access System. All rights reserved.</p>
        </footer>
      </body>
    </html>
  );
}
