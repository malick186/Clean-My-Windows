<p align="center">
  <img src="public/favicon.svg" width="80" height="80" alt="WinBoost" />
</p>

<h1 align="center">WinBoost</h1>

<p align="center">
  <strong>Manage, Optimize, and Supercharge Your Windows Experience</strong>
</p>

<p align="center">
  <a href="#features">Features</a> &bull;
  <a href="#screenshots">Screenshots</a> &bull;
  <a href="#installation">Installation</a> &bull;
  <a href="#development">Development</a> &bull;
  <a href="#building">Building</a> &bull;
  <a href="#tech-stack">Tech Stack</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version" />
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-0078d6.svg" alt="Platform" />
  <img src="https://img.shields.io/badge/electron-43.x-47848f.svg" alt="Electron" />
  <img src="https://img.shields.io/badge/react-19.x-61dafb.svg" alt="React" />
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License" />
</p>

---

## Overview

WinBoost is a free, open-source Windows optimization suite that keeps your PC clean, secure, and running at peak performance. Built with a CleanMyMac X-inspired design, it provides 12 powerful tools through an intuitive, modern interface.

No bloat. No ads. No telemetry. Just the tools you need.

## Features

### System Health Dashboard
Real-time overview of CPU, RAM, disk, and network. Animated health score ring with one-click Smart Scan.

### Cleanup & Optimization

| Tool | Description |
|---|---|
| **System Cleanup** | Remove junk files, browser caches, temp data, thumbnails, and system logs |
| **Malware Scanner** | Quick, full, and deep scan modes with threat detection and quarantine |
| **Uninstaller** | Remove applications completely with leftover file detection |
| **File Shredder** | Secure file deletion with 4 overwrite methods (up to Gutmann 35-pass) |
| **Maintenance** | 12 system maintenance scripts: flush DNS, SFC, DISM, CHKDSK, and more |

### Analysis & Tuning

| Tool | Description |
|---|---|
| **Disk Analyzer** | Visual breakdown of folder usage with charts and file type distribution |
| **Large Files Finder** | Discover space-hogging files sorted by size |
| **Registry Cleaner** | Scan and fix broken registry entries, orphaned keys, and invalid references |
| **Startup Manager** | Control startup programs with boot time impact estimation |
| **Privacy Tools** | Manage telemetry, location, camera, microphone, and data sharing settings |
| **Performance Optimizer** | 12 system tweaks with before/after benchmarks |

## Screenshots

```
Dashboard           System Cleanup      Malware Scanner
┌─────────────┐    ┌─────────────┐     ┌─────────────┐
│ Health: 85% │    │ Scan & Clean│     │ 3 Scan Modes│
│ Smart Scan  │    │ 6 Categories│     │ Threat List │
│ Module Grid │    │ Progress Bar│     │ Quarantine  │
└─────────────┘    └─────────────┘     └─────────────┘
```

## Installation

### Download Pre-built Release

Download the latest installer from the [Releases](https://github.com/malick186/Clean-My-Windows/releases) page:

- **Windows:** `WinBoost-Setup-1.0.0.exe`
- **Portable:** `win-unpacked/WinBoost.exe`

### System Requirements

- Windows 10 (build 1903+) or Windows 11
- 4 GB RAM
- 300 MB free disk space
- 64-bit processor

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Setup

```bash
# Clone the repository
git clone https://github.com/malick186/Clean-My-Windows.git
cd Clean-My-Windows/winboost

# Install dependencies
npm install

# Start development server (browser)
npm run dev

# Start Electron development mode (Windows only)
npm run electron:dev
```

> Note: `npm run electron:dev` is intended for Windows. On non-Windows platforms, use `npm run dev` to preview the app in a browser.

### Project Structure

```
winboost/
├── electron/
│   ├── main.cjs          # Electron main process
│   └── preload.cjs       # Context bridge
├── src/
│   ├── components/
│   │   ├── Layout.jsx     # App shell with sidebar
│   │   └── Sidebar.jsx    # Navigation sidebar
│   ├── pages/
│   │   ├── Dashboard.jsx      # Health overview
│   │   ├── Cleanup.jsx        # System cleanup
│   │   ├── MalwareScanner.jsx # Threat scanning
│   │   ├── Uninstaller.jsx    # App removal
│   │   ├── Shredder.jsx       # Secure deletion
│   │   ├── Maintenance.jsx    # System scripts
│   │   ├── DiskAnalyzer.jsx   # Storage analysis
│   │   ├── LargeFiles.jsx     # Space hogs
│   │   ├── RegistryCleaner.jsx# Registry fix
│   │   ├── StartupManager.jsx # Boot control
│   │   ├── PrivacyTools.jsx   # Privacy settings
│   │   └── Performance.jsx    # System tweaks
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── public/
│   └── favicon.svg
├── package.json
├── vite.config.js
└── electron-builder config (in package.json)
```

## Building

### Windows (.exe)

```bash
npm run electron:build
```

Produces:
- `release/WinBoost-Setup-1.0.0.exe` (NSIS installer)
- `release/win-unpacked/` (portable version)

### Linux (.AppImage)

```bash
npm run electron:build:linux
```

### macOS (.dmg)

```bash
npm run electron:build:mac
```

## Tech Stack

| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **Vite 8** | Build tool & dev server |
| **TailwindCSS 4** | Utility-first CSS |
| **Electron 43** | Desktop app shell |
| **electron-builder** | Windows/macOS/Linux packaging |
| **React Router 7** | Client-side routing |
| **Recharts** | Data visualization |
| **Lucide React** | Icon library |

## Contributing

Contributions are welcome. To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## License

MIT &copy; 2024 WinBoost

---

<p align="center">
  <sub>Built with AI assistance. Free and open-source forever.</sub>
</p>
