# Changelog

All notable WinBoost changes are documented here.

## [2.2.0] - 2026-08-06

### Added

- A complete Appearance settings page with System, Dark, and Light theme modes.
- Aurora, Ocean, Sunset, and Forest accent palettes applied throughout the interface.
- Automatic, Full Effects, and Reduced Motion modes, including support for the Windows reduced-motion preference.
- A title-bar theme shortcut for switching appearance without leaving the current tool.
- Local preference persistence for theme, palette, and motion settings.
- Clear local-only, privacy, backup, and UAC information in Settings.

### Improved

- Light-mode contrast, surfaces, typography, borders, controls, charts, and navigation across the application.
- Shared transitions, focus-visible states, ambient graphics, and GPU-friendly animations.
- Settings navigation, current-section labeling, and keyboard accessibility.
- Package metadata, version display, deterministic portable filename, and project documentation.

### Fixed

- Machine-wide startup entries can now be enabled or disabled through a per-action UAC prompt instead of requiring WinBoost itself to start as administrator.
- Verified HKLM registry repairs now run as one elevated operation with individual result reporting.
- Startup and registry changes create local backups before modifying Windows settings.
- The current title-bar section no longer redirects unexpectedly to Maintenance.
- Removed lint warnings from the Electron main process and preserved clean command-error reporting.

### Safety and compatibility

- WinBoost remains local-only with no account, cloud dependency, ads, or telemetry.
- Normal application launch does not require administrator rights; UAC is requested only for operations that need it.
- The portable build targets 64-bit Windows 10 and Windows 11.

[2.2.0]: https://github.com/malick186/Clean-My-Windows/releases/tag/v2.2.0
