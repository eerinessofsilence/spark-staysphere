/**
 * The designed HTML alternative to an automation's plain-text body — what a
 * guest's mail client actually renders, next to the `text` part every
 * client falls back to. Table-based and inline-styled throughout (email
 * clients strip `<style>` blocks and ignore most of Tailwind's cascade),
 * built from the same palette as the guest site (`app/globals.css`'s light
 * tokens — email has no dark-mode hook to read `prefers-color-scheme`
 * reliably, so this never tries).
 */

import { initialsOf } from './team-directory';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** A `Label: value` line — `Reference: SC-1234`, `Total: €480.00` — becomes a two-column detail row; anything else is a paragraph. */
const DETAIL_LINE = /^([A-Za-z][\w -]{0,30}):\s*(.+)$/;

interface Block {
  kind: 'paragraph' | 'details';
  lines: string[];
}

/** Blank-line-separated paragraphs, except a run of consecutive `Label: value` lines, which becomes its own `details` block regardless of the blank lines around it. */
function toBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ kind: 'paragraph', lines: paragraph });
    paragraph = [];
  };
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }
    if (DETAIL_LINE.test(line)) {
      flushParagraph();
      const last = blocks.at(-1);
      if (last?.kind === 'details') last.lines.push(line);
      else blocks.push({ kind: 'details', lines: [line] });
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return blocks;
}

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function renderBlock(block: Block): string {
  if (block.kind === 'paragraph') {
    return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#161616;font-family:${FONT_STACK}">${block.lines.map(escapeHtml).join('<br>')}</p>`;
  }
  const rows = block.lines
    .map((line) => {
      const match = DETAIL_LINE.exec(line);
      if (!match) return '';
      const [, label, value] = match;
      return `<tr>
        <td style="padding:6px 0;font-size:13px;color:#66665f;font-family:${FONT_STACK}">${escapeHtml(label!)}</td>
        <td style="padding:6px 0;font-size:13px;color:#161616;font-weight:600;text-align:right;font-family:${FONT_STACK}">${escapeHtml(value!)}</td>
      </tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-top:1px solid #ddd9d0;border-bottom:1px solid #ddd9d0">
    <tbody>${rows}</tbody>
  </table>`;
}

/**
 * `subject`/`body` are the same strings a guest's mail client's preview pane
 * and the admin's own preview show — this only adds the wrapper around
 * `body`: an ink header band with the hotel's name, a white card for the
 * text (paragraphs, plus any `Label: value` lines pulled into a details
 * table), and a muted footer. See `EmailAutomationsService.preview`.
 */
export function renderAutomationEmailHtml({ hotelName, subject, body }: { hotelName: string; subject: string; body: string }): string {
  const blocks = toBlocks(body);
  const content = blocks.map(renderBlock).join('');
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f3f1ec;font-family:${FONT_STACK}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f1ec;padding:32px 16px">
      <tbody>
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #ddd9d0">
              <tbody>
                <tr>
                  <td style="background-color:#161616;padding:20px 28px">
                    <!-- No hotel-uploaded logo exists yet (MediaStoragePort is declared, not implemented — see CLAUDE.md); an initials badge stands in, the same idea as the admin's own avatar (initialsOf, team-directory.ts). -->
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tbody>
                        <tr>
                          <td style="width:36px">
                            <table role="presentation" width="36" height="36" cellpadding="0" cellspacing="0" style="width:36px;height:36px;background-color:#b8603a;border-radius:10px">
                              <tbody>
                                <tr>
                                  <td align="center" valign="middle" style="width:36px;height:36px;font-size:14px;font-weight:700;color:#ffffff;font-family:${FONT_STACK}">${escapeHtml(initialsOf(hotelName))}</td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                          <td style="width:12px">&nbsp;</td>
                          <td valign="middle">
                            <span style="display:block;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#f7f5f0;font-family:${FONT_STACK}">${escapeHtml(hotelName)}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px">
                    ${content}
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>`;
}
