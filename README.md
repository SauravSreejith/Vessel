# Vessel 🚢

A lightweight, secure Discord wrapper for Linux — built with Electron.

Vessel wraps `discord.com` in a native window with proper system notifications, tray support, and window-state memory. It is deliberately minimal: no patching, no plugin system, no telemetry. Just Discord, running reliably on your desktop **without ever forcing a manual package download or full system upgrade just to keep chatting.**

---

## Features

| Feature | Details |
|---|---|
| **System notifications** | Routes Discord's web notifications through D-Bus (works on X11 and Wayland) |
| **System tray** | Minimize to tray; click to show/hide; unread badge in tray label |
| **Window state** | Remembers size, position, and maximized state between launches |
| **Single instance** | Focuses the existing window if you launch a second copy |
| **Custom CSS** | Drop a `custom.css` in the config directory to theme Discord |
| **Unread badge** | Parses Discord's page title and updates the tray label |
| **Error page** | Friendly offline screen instead of a blank white page |
| **Keyboard shortcuts** | `Ctrl+R` reload, `Ctrl+Shift+I` DevTools, `F11` fullscreen |
| **Secure by default** | `contextIsolation: true`, `sandbox: true`, permission allowlist |

---

## Installation

### AppImage (recommended — works on any distro)

```bash
# Download the latest release
wget https://github.com/SauravSreejith/Vessel/releases/latest/download/Vessel-x86_64.AppImage
chmod +x Vessel-x86_64.AppImage
./Vessel-x86_64.AppImage
```

### Debian / Ubuntu (.deb)

```bash
wget https://github.com/SauravSreejith/Vessel/releases/latest/download/vessel_1.0.0_amd64.deb
sudo dpkg -i vessel_1.0.0_amd64.deb
```

---

## Building from source

**Requirements:** Node.js ≥ 18, npm ≥ 9

```bash
git clone https://github.com/SauravSreejith/Vessel.git
cd vessel
npm install

# Run in development
npm start

# Build an AppImage
npm run dist:appimage

# Build all targets (AppImage + deb)
npm run build
```

### Icon

Place your icon at `icons/icon.png` (512×512 px recommended). electron-builder
will automatically generate all required sizes. A fallback is used if no icon
is provided.

---

## Custom CSS

Vessel loads a `custom.css` file from your config directory on every page load:

| Platform | Path |
|---|---|
| Linux | `~/.config/vessel/custom.css` |

Example — make the sidebar narrower:

```css
nav[class*="guilds"] { width: 60px !important; }
```

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+R` | Reload Discord |
| `Ctrl+Shift+I` | Open DevTools (dev builds only) |
| `F11` | Toggle fullscreen |

---

## Security model

| Setting | Value | Why |
|---|---|---|
| `nodeIntegration` | `false` | Page JS cannot access Node APIs |
| `contextIsolation` | `true` | Preload is isolated from page context |
| `sandbox` | `true` | Chromium sandbox fully enabled |
| `setPermissionRequestHandler` | Allowlist | Only `notifications`, `media`, `clipboard-read`, `fullscreen` are granted, and only to `discord.com` origins |
| Navigation guard | Enabled | External links open in the system browser; Discord-internal popups are sandboxed |

The preload communicates with the main process over a narrow, typed IPC channel (`show-notification`, `set-badge`). No arbitrary code can be passed across the boundary.

---

## Why not the official Discord app?

The primary reason Vessel exists is the excruciating update process on Linux. 

When the official Discord client pushes an update, it frequently locks you out until you update the local package. On Debian/Ubuntu, this means manually downloading and installing a 100MB `.deb` file over and over. 

On rolling releases like Arch Linux, it's even worse. You can't just run `pacman -S discord` without risking a partial upgrade that breaks your `.so` system libraries. To safely update Discord, you are forced into running `pacman -Syu` — turning a simple chat app update into a mandatory 3-5 GB full system upgrade. 

Because Vessel is a native wrapper around the web client, **you never have to download an update just to keep chatting.** The web client updates automatically on refresh. Vessel stays out of your way, running securely via Electron with `contextIsolation` and `sandbox` fully enabled. It's ~150 lines of code — you can read the entire source in five minutes.

---

## Troubleshooting

**Notifications don't appear**
- Ensure `libnotify` is installed: `sudo apt install libnotify4` (Debian).
- Check your desktop notification settings haven't silenced the app.

**Screen share / camera doesn't work**
- Voice and video permissions are granted by default. If you're on Wayland, screen sharing may require `--enable-features=WebRTCPipeWireCapturer`. You can set this in a `.desktop` file:
  ```
  Exec=/path/to/Vessel.AppImage --enable-features=WebRTCPipeWireCapturer %U
  ```

**Tray icon missing on GNOME**
- Install the [AppIndicator extension](https://extensions.gnome.org/extension/615/appindicator-support/).

---

## Contributing

PRs are welcome. Please keep the scope minimal — Vessel's goal is to be a thin, auditable wrapper, not a full-featured client mod.

---

## License

MIT © 2026 Saurav Sreejith
