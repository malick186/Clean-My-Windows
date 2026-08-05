const platform = process.platform

if (platform !== 'win32') {
  console.error('\nERROR: WinBoost Electron desktop mode is supported only on Windows.')
  console.error('Run `npm run dev` to preview the React UI in the browser on this machine.')
  console.error('')
  process.exit(1)
}
