# Google Cloud View

A desktop application for browsing and managing files in Google Cloud Storage (or S3-compatible storage).

Built with Electron, React, and TypeScript.

## Features

- **File browsing** - Tree-based folder navigation with breadcrumbs
- **Upload** - File dialog or drag-and-drop from desktop
- **Download** - Individual files or entire folders as ZIP
- **Copy, move, rename, duplicate, delete** - Full file management
- **Search** - Real-time filtering of files
- **Sorting** - By name, size, or last modified date
- **Drag and drop** - Move files between folders (Ctrl+drag to copy)
- **Multiple connections** - Save and switch between storage endpoints
- **Progress tracking** - Real-time upload/download progress bar

## Getting Started

### Prerequisites

- Node.js
- npm

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build        # Compile TypeScript and build with Vite
npm run dist         # Package as standalone desktop app (outputs to release/)
```

### Test

```bash
npm run test
```

## Project Structure

```
src/                        # React frontend
  components/               # UI components (FileBrowser, Toolbar, etc.)
  hooks/                    # React hooks (useGcs, useConnections)
  utils/                    # Formatting helpers
electron/                   # Electron main process
  gcs/                      # S3-compatible storage client
```

## License

ISC
