/**
 * Editor chrome, inline and prefixed `pe-` — same rationale as the canvas's
 * own `CANVAS_STYLES` (`markup-canvas.tsx`): the drawing tools need CSS that
 * Tailwind's utility classes cannot express as cleanly (a `[data-active]`
 * tool state, floating panels sized against the editor's own box through a
 * container query), so they stay one block, colours drawn from
 * `app/globals.css`'s own tokens. Ported from `svg-editor-kit`'s
 * `client/styles.js`, then laid out like a design tool: the canvas fills the
 * editor and every panel floats over it.
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
    --pe-gap: 12px;
    --pe-dock-room: 64px;

    position: relative;
    display: flex;
    height: 100%;
    min-height: 0;
    container-type: inline-size;
    background: var(--pe-bg);
    color: var(--pe-fg);
    font: 14px/1.4 var(--font-sans, system-ui), -apple-system, "Segoe UI", Roboto, sans-serif;
    outline: none;
    border-radius: 18px;
    overflow: hidden;
  }
  .pe-root *, .pe-root *::before, .pe-root *::after { box-sizing: border-box; }

  .pe-canvas { flex: 1; min-width: 0; }

  .pe-float {
    position: absolute;
    z-index: 2;
    background: var(--pe-bg);
    border: 1px solid var(--pe-border);
    border-radius: 14px;
    box-shadow: 0 12px 32px -12px rgb(0 0 0 / 0.35);
  }

  /* Side panels: pinned to the top corners, as tall as their content, never taller than the canvas. */
  .pe-float-left,
  .pe-float-right {
    top: var(--pe-gap);
    display: flex;
    flex-direction: column;
    max-height: calc(100% - var(--pe-gap) * 2);
    overflow: hidden;
  }
  .pe-float-left { left: var(--pe-gap); width: 240px; }
  /* Stops above the bottom-right corner, where the "?" sits. */
  .pe-float-right { right: var(--pe-gap); width: 280px; max-height: calc(100% - var(--pe-gap) - var(--pe-dock-room)); }

  /* Where the canvas is too narrow for the dock to pass between the panels, they stop above it. */
  @container (max-width: 900px) {
    .pe-float-left,
    .pe-float-right { max-height: calc(100% - var(--pe-gap) - var(--pe-dock-room)); }
    .pe-float-left { width: calc(50% - var(--pe-gap) * 1.5); max-width: 240px; }
    .pe-float-right { width: calc(50% - var(--pe-gap) * 1.5); max-width: 280px; }
  }

  .pe-side-head {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 44px;
    padding: 6px 8px 6px 12px;
    border-bottom: 1px solid var(--pe-border);
  }
  .pe-side-title { margin: 0; font-size: 13px; font-weight: 600; }
  .pe-truncate { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pe-head-end { display: flex; flex: none; align-items: center; gap: 8px; font-size: 12px; color: var(--pe-muted); }
  .pe-muted { color: var(--pe-muted); font-size: 12px; }
  .pe-push { margin-left: auto; }

  .pe-notice {
    margin: 0;
    padding: 8px 12px;
    border-bottom: 1px solid var(--pe-border);
    font-size: 12px;
    color: var(--pe-fg);
  }
  .pe-notice[data-variant="error"],
  .pe-save[data-error] { color: var(--pe-danger); }

  .pe-panel-body { flex: 1; min-height: 0; overflow-y: auto; }
  .pe-panel-section { padding: 12px; }
  .pe-section-heading { margin: 0 0 10px; font-size: 13px; font-weight: 600; }

  /* The dock: the draw tools, bottom centre. */
  .pe-dock {
    bottom: var(--pe-gap);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 6px;
  }
  .pe-dock .pe-btn { min-width: 36px; height: 36px; padding: 0 9px; border-radius: 10px; }
  .pe-dock .pe-icon { width: 18px; height: 18px; }
  .pe-dock-label { padding: 0 2px; font-size: 13px; font-weight: 500; }
  .pe-dock-sep { width: 1px; height: 20px; margin: 0 6px; background: var(--pe-border); }

  /* Help: a round "?" in the bottom-right corner, its popover above it. */
  .pe-help-toggle {
    right: var(--pe-gap);
    bottom: var(--pe-gap);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border-radius: 999px;
    color: var(--pe-fg);
    cursor: pointer;
  }
  .pe-help-toggle:hover { background: var(--pe-hover); }
  .pe-help-toggle[aria-expanded="true"] { background: var(--pe-active); color: var(--pe-accent); }
  .pe-help-toggle:focus-visible { outline: 2px solid var(--pe-accent); outline-offset: 1px; }
  .pe-help {
    right: var(--pe-gap);
    bottom: calc(var(--pe-gap) + 48px);
    z-index: 3;
    display: flex;
    flex-direction: column;
    width: min(300px, calc(100% - var(--pe-gap) * 2));
    max-height: calc(100% - var(--pe-gap) * 2 - 48px);
    overflow: hidden;
  }

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
  .pe-list { flex: 1; min-height: 0; margin: 0; padding: 6px; list-style: none; overflow-y: auto; }
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
`;
