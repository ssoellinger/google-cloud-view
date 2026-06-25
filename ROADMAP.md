# Roadmap — Missing Features & Ideas

A wishlist of features that would make **Google Cloud View** more capable.
Grouped by value vs. effort.

## What exists today

Saved connections (secrets encrypted via the OS keychain) · lazy tree browse
(expand-all/collapse-all) · sort by name/size/modified · client-side search ·
upload (file dialog + drag-drop into folders) · download (single file /
folder-as-ZIP / multi-select-as-ZIP) · in-app preview · drag files out to the
desktop · delete · move / copy / duplicate / rename via drag-drop · create
folder/subfolder · per-row action menu · keyboard shortcuts · shift-click range
select · copy path · single-operation progress bar.

---

## ✅ Shipped

- **In-app file preview** — images / video / audio / PDF / text, with a
  download fallback (v0.0.9).
- **Drag files OUT to the desktop** — native `startDrag` from the file icon
  (v0.0.7).
- **Keyboard shortcuts** — Ctrl+A, Delete, Escape, Enter (v0.0.10).
- **Shift-click range select** — contiguous range in visual order (v0.0.11).
- **Copy path / object key** — row menu + breadcrumb (v0.0.12).
- **Clear selection after a bulk download** (v0.0.13).
- **Secure credential storage** — secrets encrypted with `safeStorage`
  (v0.0.14).
- **listFolders pagination** — folders with >1000 entries no longer truncate
  (v0.0.6).

---

## 🔥 Top picks (still open)

1. **Copy shareable link (signed URL)** — generate a presigned GET URL with an
   expiry and copy it to the clipboard. The HMAC signing code already exists in
   `gcs-client.ts`.
2. **Object properties panel** — content-type, exact size, ETag/MD5, storage
   class, custom metadata, full timestamp. One `HEAD` request away.

## ⚡ Quick wins (still open)

3. **F2 to rename / double-click to open** — deferred from the keyboard-shortcut
   work; needs lifting the per-row rename state and resolving overlap with
   click-to-preview.

## 🚀 Power-user / advanced

4. **Bucket-wide server-side search** — current search only filters
   already-loaded nodes, so a deep file can't be found without manual
   expansion. A recursive/prefix `list` search would fix it.
5. **Transfer queue with cancel + parallelism** — uploads/downloads run one at
   a time and the single progress bar can't show bulk progress or be
   cancelled. A queue with concurrency + abort scales much better.
6. **Folder upload (recursive)** — currently only individual files; dragging a
   folder should recreate its structure.
7. **Overwrite / conflict prompt on upload** — the `exists()` API already
   exists but is unused; warn before clobbering.
8. **Inline text-file editing + "New file"** — create/edit small
   text/JSON/config files in place.
9. **Object versioning** — list and restore previous versions (when the bucket
   has versioning enabled).
