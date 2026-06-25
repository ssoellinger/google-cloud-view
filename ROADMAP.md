# Roadmap — Missing Features & Ideas

A wishlist of features that would make **Google Cloud View** more capable.
Grouped by value vs. effort. Nothing here is implemented yet.

## What exists today

Saved connections · lazy tree browse (expand-all/collapse-all) · sort by
name/size/modified · client-side search · upload (file dialog + drag-drop into
folders) · download (single file / folder-as-ZIP / multi-select-as-ZIP) ·
delete · move / copy / duplicate / rename via drag-drop · create
folder/subfolder · per-row action menu · single-operation progress bar.

---

## 🔥 Top picks (high value + genuinely cool)

1. **In-app file preview** — click an image / text / PDF / video and view it
   without downloading. Biggest UX upgrade for a storage browser
   (temp download + a modal viewer).
2. **Copy shareable link (signed URL)** — generate a presigned GET URL with an
   expiry and copy it to the clipboard. The HMAC signing code already exists in
   `gcs-client.ts`.
3. **Drag files OUT to the desktop** — use Electron's
   `webContents.startDrag` to drag a row straight into Explorer to download.
   Pairs with the existing drag-in upload.
4. **Object properties panel** — content-type, exact size, ETag/MD5, storage
   class, custom metadata, full timestamp. One `HEAD` request away.

## ⚡ Quick wins

5. **Keyboard shortcuts** — `Delete` to delete, `F2` rename,
   `Enter`/double-click to open or preview, `Ctrl+A` select all, `Esc` to
   cancel. Currently mouse-only.
6. **Shift-click range select** — select a span of rows instead of one
   checkbox at a time.
7. **Copy path / object key to clipboard** — from the row menu and breadcrumb.
8. **Clear selection after a bulk action** — selection currently persists after
   download.
9. **Secure credential storage** — use Electron `safeStorage` (OS keychain) so
   the secret persists instead of being re-typed on every connect.

## 🚀 Power-user / advanced

10. **Bucket-wide server-side search** — current search only filters
    already-loaded nodes, so a deep file can't be found without manual
    expansion. A recursive/prefix `list` search would fix it.
11. **Transfer queue with cancel + parallelism** — uploads/downloads run one at
    a time and the single progress bar can't show bulk progress or be
    cancelled. A queue with concurrency + abort scales much better.
12. **Folder upload (recursive)** — currently only individual files; dragging a
    folder should recreate its structure.
13. **Overwrite / conflict prompt on upload** — the `exists()` API already
    exists but is unused; warn before clobbering.
14. **Inline text-file editing + "New file"** — create/edit small
    text/JSON/config files in place.
15. **Object versioning** — list and restore previous versions (when the bucket
    has versioning enabled).

---

## ⚠️ Known correctness gap (foundation for #10)

`GcsClient.listFolders()` (`electron/gcs/gcs-client.ts`) requests
`max-keys=1000` but **never follows the continuation token** (unlike
`listItems`, which does). Any single folder with **more than 1000
objects/subfolders silently shows only the first 1000**. Fixing this is the
natural foundation for bucket-wide search and pagination/virtualization of very
large folders.
