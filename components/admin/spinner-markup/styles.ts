/**
 * Editor chrome, inline and prefixed `pe-` — same rationale as the canvas's
 * own `CANVAS_STYLES` (`markup-canvas.tsx`): the drawing tools need CSS that
 * Tailwind's utility classes cannot express as cleanly (a `[data-active]`
 * toolbar state, a scrollable side panel with its own scrollbar area), so
 * they stay one block, colours drawn from `app/globals.css`'s own tokens
 * rather than the reference kit's neutral defaults. Ported from
 * `svg-editor-kit`'s `client/styles.js`.
 */
export const EDITOR_STYLES = `
  .pe-root {
    --pe-bg: var(--color-card);
    --pe-fg: var(--color-foreground);
    --pe-muted: var(--color-muted-foreground);
    --pe-border: var(--color-border);
    --pe-hover: var(--color-stone);
    --pe-active: var(--color-tint-clay);
    --pe-accent: var(--color-tint-clay-ink);
    --pe-danger: #dc2626;

    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--pe-bg);
    color: var(--pe-fg);
    font: 14px/1.4 var(--font-sans, system-ui), -apple-system, "Segoe UI", Roboto, sans-serif;
    outline: none;
    border-radius: 18px;
    overflow: hidden;
  }
  .pe-root *, .pe-root *::before, .pe-root *::after { box-sizing: border-box; }

  .pe-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--pe-border);
  }
  .pe-group {
    display: flex;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--pe-border);
    border-radius: 999px;
  }
  .pe-toolbar-end {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    margin-left: auto;
    font-size: 12px;
    color: var(--pe-muted);
  }
  .pe-notice {
    max-width: 420px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--pe-fg);
  }
  .pe-notice[data-variant="error"],
  .pe-save[data-error] { color: var(--pe-danger); }

  .pe-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 30px;
    height: 30px;
    padding: 0 8px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .pe-btn:hover:not(:disabled) { background: var(--pe-hover); }
  .pe-btn[data-active] { background: var(--pe-active); color: var(--pe-accent); }
  .pe-btn:disabled { opacity: .4; cursor: default; }
  .pe-btn:focus-visible { outline: 2px solid var(--pe-accent); outline-offset: 1px; }
  .pe-btn-outline { height: 26px; border: 1px solid var(--pe-border); font-size: 12px; color: var(--pe-fg); border-radius: 999px; }
  .pe-icon { width: 16px; height: 16px; flex: none; }

  .pe-body { display: flex; flex: 1; min-height: 0; }
  .pe-canvas { flex: 1; min-width: 0; }

  .pe-side { display: flex; flex-direction: column; flex: none; min-height: 0; background: var(--pe-bg); }
  .pe-side-left { width: 240px; border-right: 1px solid var(--pe-border); }
  .pe-side-right { width: 280px; border-left: 1px solid var(--pe-border); }
  .pe-side-collapsed { flex: none; padding: 8px; border-right: 1px solid var(--pe-border); }
  .pe-side-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--pe-border);
  }
  .pe-side-title { margin: 0; font-size: 13px; font-weight: 600; }
  .pe-muted { color: var(--pe-muted); font-size: 12px; }
  .pe-push { margin-left: auto; }

  .pe-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; }
  .pe-section + .pe-section { margin-top: 16px; }
  .pe-section-title { margin: 0 0 6px; font-size: 12px; font-weight: 500; color: var(--pe-muted); }
  .pe-rows { margin: 0; }
  .pe-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
  .pe-row dt { display: flex; flex: none; align-items: center; gap: 2px; margin: 0; }
  .pe-row dd { margin: 0; font-size: 12px; line-height: 1.25; color: var(--pe-muted); }
  .pe-kbd {
    padding: 2px 5px;
    border: 1px solid var(--pe-border);
    border-radius: 4px;
    background: var(--pe-hover);
    font: 500 10px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .pe-note {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--pe-border);
    font-size: 12px;
    color: var(--pe-muted);
  }
  .pe-note p { margin: 0 0 8px; }

  .pe-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 37px;
    margin: 0;
    padding: 8px 12px;
    border-bottom: 1px solid var(--pe-border);
    font-size: 12px;
    color: var(--pe-muted);
  }
  .pe-empty { margin: 0; padding: 12px; font-size: 12px; color: var(--pe-muted); }
  .pe-list { flex: none; margin: 0; padding: 6px; list-style: none; max-height: 40%; overflow-y: auto; }
  .pe-item { display: flex; align-items: center; gap: 8px; padding: 2px 8px; border-radius: 8px; }
  .pe-item:hover { background: var(--pe-hover); }
  .pe-item[data-selected] { background: var(--pe-active); }
  .pe-item-main {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 4px 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .pe-item-index { width: 20px; flex: none; font-size: 12px; color: var(--pe-muted); font-variant-numeric: tabular-nums; }
  .pe-item-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pe-item-delete {
    display: inline-flex;
    padding: 2px;
    border: 0;
    background: none;
    color: var(--pe-muted);
    cursor: pointer;
    opacity: 0;
  }
  .pe-item:hover .pe-item-delete,
  .pe-item-delete:focus-visible { opacity: 1; }
  .pe-item-delete:hover { color: var(--pe-danger); }

  .pe-side-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-top: 1px solid var(--pe-border);
  }
  /* Docked in the header instead of the sidebar, when the caller has no zone list to dock it above. */
  .pe-toolbar > .pe-side-toolbar {
    padding: 0;
    border-top: 0;
  }

  .pe-target {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    margin: 10px;
    border: 1px solid var(--pe-border);
    border-radius: 18px;
    background: var(--pe-hover);
    overflow: hidden;
  }
`;
