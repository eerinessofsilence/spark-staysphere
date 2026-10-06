'use client';

import * as React from 'react';
import { useAdminT } from '@/lib/i18n/admin/context';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { IconClose, IconHelp } from './icons';

/**
 * A key cap is either a key's own name (`V`, `Esc`, `Shift` — the same on
 * every keyboard, never translated) or a gesture (`Wheel`, `Drag`) that has
 * a name in each language; the latter are given as dictionary keys.
 */
type Cap = string | { key: AdminTranslationKey };

const SECTIONS: Array<{ title: AdminTranslationKey; rows: Array<[Cap[], AdminTranslationKey]> }> = [
  {
    title: 'editor.scTools',
    rows: [
      [['V'], 'editor.scSelect'],
      [['P'], 'editor.scPolygon'],
      [['R'], 'editor.scRect'],
      [['S'], 'editor.scSpin'],
      [['Space'], 'editor.scPan'],
      [[{ key: 'editor.kWheel' }], 'editor.scZoom'],
    ],
  },
  {
    title: 'editor.scDrawing',
    rows: [
      [[{ key: 'editor.kClick' }], 'editor.scPlace'],
      [['Enter'], 'editor.scClose'],
      [[{ key: 'editor.kDoubleClick' }], 'editor.scClose'],
      [[{ key: 'editor.kClick' }], 'editor.scCloseFirst'],
      [['Esc'], 'editor.scCancel'],
    ],
  },
  {
    title: 'editor.scEditing',
    rows: [
      [[{ key: 'editor.kDrag' }], 'editor.scMoveWhole'],
      [[{ key: 'editor.kDrag' }, '■'], 'editor.scMoveVertex'],
      [['Alt', { key: 'editor.kClickLower' }, '■'], 'editor.scDeleteVertex'],
      [[{ key: 'editor.kDrag' }, '●'], 'editor.scRound'],
      [['Alt', { key: 'editor.kClickLower' }, '●'], 'editor.scInsert'],
      [[{ key: 'editor.kDoubleClick' }, '●'], 'editor.scStraighten'],
    ],
  },
  {
    title: 'editor.scWhole',
    rows: [
      [['M'], 'editor.scSnap'],
      [['Ctrl', 'D'], 'editor.scDuplicate'],
      [['←↑→↓'], 'editor.scNudge1'],
      [['Shift', '←↑→↓'], 'editor.scNudge10'],
      [['Delete'], 'editor.scDeletePolygon'],
      [['Esc'], 'editor.scClear'],
    ],
  },
  {
    title: 'editor.scUndo',
    rows: [
      [['Ctrl', 'Z'], 'editor.scUndoRow'],
      [['Ctrl', 'Shift', 'Z'], 'editor.scRedoRow'],
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
  const t = useAdminT();
  const [open, setOpen] = React.useState(false);
  const cap = (item: Cap) => (typeof item === 'string' ? item : t(item.key));

  return (
    <>
      <button
        type="button"
        className="pe-float pe-help-toggle"
        aria-expanded={open}
        aria-controls="pe-shortcuts"
        aria-label={open ? t('editor.shortcutsHide') : t('editor.shortcutsShow')}
        title={t('editor.shortcuts')}
        onClick={() => setOpen((value) => !value)}
      >
        <IconHelp className="pe-icon" />
      </button>

      {open ? (
        <aside id="pe-shortcuts" className="pe-float pe-help" aria-label={t('editor.shortcuts')}>
          <div className="pe-side-head">
            <h2 className="pe-side-title">{t('editor.shortcutsTitle')}</h2>
            <button
              type="button"
              className="pe-btn"
              aria-label={t('editor.shortcutsClose')}
              title={t('editor.close')}
              onClick={() => setOpen(false)}
            >
              <IconClose className="pe-icon" />
            </button>
          </div>

          <div className="pe-scroll">
            {SECTIONS.map((section) => (
              <div key={section.title} className="pe-section">
                <p className="pe-section-title">{t(section.title)}</p>
                <dl className="pe-rows">
                  {section.rows.map(([keys, label]) => (
                    <div key={label} className="pe-row">
                      <dt>
                        {keys.map((item, index) => (
                          <Key key={index}>{cap(item)}</Key>
                        ))}
                      </dt>
                      <dd>{t(label)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}

            <div className="pe-note">
              <p>{t('editor.noteHandles')}</p>
              <p>
                <Key>M</Key> {t('editor.noteSnap')}
              </p>
              <p>
                <Key>S</Key> {t('editor.noteSpin')}
              </p>
              <p>{t('editor.noteFocus')}</p>
            </div>
          </div>
        </aside>
      ) : null}
    </>
  );
}
