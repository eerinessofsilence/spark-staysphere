import { describe, expect, it } from 'vitest';
import { renderAutomationEmailHtml } from './email-html';

describe('renderAutomationEmailHtml', () => {
  it('renders a plain paragraph and pulls Label: value lines into a details table', () => {
    const html = renderAutomationEmailHtml({
      hotelName: 'Asteria Cove',
      subject: 'Booking confirmed',
      body: 'Hi Alex,\n\nYour stay is confirmed.\n\nReference: SC-1234\nCheck-in: 5 Oct 2026\n\nSee you soon,\nAsteria Cove',
    });
    expect(html).toContain('Asteria Cove');
    expect(html).toContain('Your stay is confirmed.');
    expect(html).toContain('<td style="padding:6px 0;font-size:13px;color:#66665f;font-family:-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif">Reference</td>');
    expect(html).toContain('SC-1234');
    expect(html).toContain('5 Oct 2026');
  });

  it('escapes html-sensitive characters in every field', () => {
    const html = renderAutomationEmailHtml({
      hotelName: '<Hotel> & "Co"',
      subject: '<script>alert(1)</script>',
      body: "Hi <b>Alex</b> & guest,\n\nReference: <1234> & 'more'",
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>Alex</b>');
    expect(html).toContain('&lt;Hotel&gt; &amp; &quot;Co&quot;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Hi &lt;b&gt;Alex&lt;/b&gt; &amp; guest,');
  });

  it('keeps paragraphs and details in the order they appear', () => {
    const html = renderAutomationEmailHtml({
      hotelName: 'Asteria Cove',
      subject: 'Thank you',
      body: 'Reference: SC-1\n\nThanks for staying.',
    });
    const detailsIndex = html.indexOf('SC-1');
    const paragraphIndex = html.indexOf('Thanks for staying.');
    expect(detailsIndex).toBeGreaterThan(-1);
    expect(paragraphIndex).toBeGreaterThan(detailsIndex);
  });
});
