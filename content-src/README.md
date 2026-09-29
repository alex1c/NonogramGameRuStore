# content-src

Human-editable / pipeline-controlled production content sources for Phase 8.

## Layout

- `rejections.json` — human rejection list (hash/id + reason). Generator skips these.
- Authored ASCII templates currently live in `scripts/content/families/authoredTemplates.ts`
  (pilot). Future batches may move large libraries into this directory as `.json` / `.nona` files.

## Rules

- Solution bitmap is source of truth; clues are generated.
- Russian titles in metadata; ASCII-friendly IDs.
- Do not import copyrighted puzzle packs.
- Review artifacts are **not** stored here — see `review-artifacts/` (gitignored).
