'use client';

import * as React from 'react';
import { IconClose, IconHelp } from './icons';

const SECTIONS: Array<{ title: string; rows: Array<[string[], string]> }> = [
  {
    title: 'Tools',
    rows: [
      [['V'], 'Select'],
      [['P'], 'Polygon'],
      [['R'], 'Rectangle'],
      [['S'], 'Spin the building'],
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

function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="pe-kbd">{children}</kbd>;
}

/**
 * A "?" in the canvas's bottom-right corner that opens the shortcut list over
 * the image, the way a design tool keeps help out of the working area until
 * it is asked for. Ported from `svg-editor-kit`'s `client/shortcuts-panel.jsx`.
 */
export function ShortcutsPanel() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        className="pe-float pe-help-toggle"
        aria-expanded={open}
        aria-controls="pe-shortcuts"
        aria-label={open ? 'Hide shortcuts' : 'Show shortcuts'}
        title="Keyboard shortcuts"
        onClick={() => setOpen((value) => !value)}
      >
        <IconHelp className="pe-icon" />
      </button>

      {open ? (
        <aside id="pe-shortcuts" className="pe-float pe-help" aria-label="Keyboard shortcuts">
          <div className="pe-side-head">
            <h2 className="pe-side-title">Shortcuts</h2>
            <button type="button" className="pe-btn" aria-label="Close shortcuts" title="Close" onClick={() => setOpen(false)}>
              <IconClose className="pe-icon" />
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
              <p>
        <Key>S</Key> then drag turns the building. Letting go settles it on the nearest key angle and
        opens that frame — zones live only on those.
      </p>
      <p>Keys work while focus is inside the editor — click the image first.</p>
            </div>
          </div>
        </aside>
      ) : null}
    </>
  );
}
