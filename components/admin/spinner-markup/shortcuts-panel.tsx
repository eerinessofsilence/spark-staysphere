'use client';

import * as React from 'react';
import { IconPanelClose, IconPanelOpen } from './icons';

const STORAGE_KEY = 'spinner-markup.shortcuts-open';

const SECTIONS: Array<{ title: string; rows: Array<[string[], string]> }> = [
  {
    title: 'Tools',
    rows: [
      [['V'], 'Select'],
      [['P'], 'Polygon'],
      [['R'], 'Rectangle'],
      [['Space'], 'Pan (or the middle button)'],
      [['Wheel'], 'Zoom 1×–4×'],
    ],
  },
  {
    title: 'Drawing',
    rows: [
      [['Click'], 'Place a point'],
      [['Enter'], 'Close the contour'],
      [['Click'], 'On the first point — closes it'],
      [['Esc'], 'Cancel the contour'],
    ],
  },
  {
    title: 'Editing a contour',
    rows: [
      [['Drag'], 'Inside the shape — move it whole'],
      [['Drag', '■'], 'Move a vertex'],
      [['Alt', 'click', '■'], 'Delete a vertex'],
      [['Drag', '●'], 'Round a side'],
      [['Alt', 'click', '●'], 'Insert a vertex'],
      [['2 clicks', '●'], 'Straighten a side'],
    ],
  },
  {
    title: 'Whole polygon',
    rows: [
      [['M'], 'Snap to neighbours'],
      [['Ctrl', 'D'], 'Duplicate, offset'],
      [['←↑→↓'], 'Nudge by 1 px'],
      [['Shift', '←↑→↓'], 'Nudge by 10 px'],
      [['Delete'], 'Delete the polygon'],
      [['Esc'], 'Clear selection'],
    ],
  },
  {
    title: 'Undo',
    rows: [
      [['Ctrl', 'Z'], 'Undo'],
      [['Ctrl', 'Shift', 'Z'], 'Redo'],
    ],
  },
];

// localStorage can throw: private mode, cookies blocked, a cross-origin
// iframe. Whether the panel is collapsed is a convenience, not worth
// crashing over.
function readOpen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function writeOpen(open: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(open));
  } catch {
    // Not remembered — not a problem.
  }
}

function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="pe-kbd">{children}</kbd>;
}

/** Ported from `svg-editor-kit`'s `client/shortcuts-panel.jsx`, in English. */
export function ShortcutsPanel() {
  // The panel eats into the canvas's own width, so whether it is collapsed is remembered.
  const [open, setOpen] = React.useState(true);

  React.useEffect(() => {
    setOpen(readOpen());
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    writeOpen(next);
  }

  if (!open) {
    return (
      <div className="pe-side-collapsed">
        <button type="button" className="pe-btn" aria-label="Show shortcuts" title="Show shortcuts" onClick={toggle}>
          <IconPanelOpen />
        </button>
      </div>
    );
  }

  return (
    <aside className="pe-side pe-side-left">
      <div className="pe-side-head">
        <h2 className="pe-side-title">Controls</h2>
        <button type="button" className="pe-btn" aria-label="Collapse shortcuts" title="Collapse shortcuts" onClick={toggle}>
          <IconPanelClose />
        </button>
      </div>

      <div className="pe-scroll">
        {SECTIONS.map((section) => (
          <div key={section.title} className="pe-section">
            <p className="pe-section-title">{section.title}</p>
            <dl className="pe-rows">
              {section.rows.map(([keys, label]) => (
                <div key={label + keys.join()} className="pe-row">
                  <dt>
                    {keys.map((key) => (
                      <Key key={key}>{key}</Key>
                    ))}
                  </dt>
                  <dd>{label}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}

        <div className="pe-note">
          <p>■ — a vertex, ● — the middle of a side. Handles show on the selected polygon.</p>
          <p>
            <Key>M</Key> pulls the selected polygon's vertices to its neighbours' vertices and sides when
            they're within 8 px — that's how a gap between neighbouring polygons closes.
          </p>
          <p>Keys work while focus is inside the editor — click the image first.</p>
        </div>
      </div>
    </aside>
  );
}
