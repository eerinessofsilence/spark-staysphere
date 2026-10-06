import * as React from 'react';
import { Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

/** One row, already formatted for display — the same strings the on-screen table shows, not raw booking data. */
export interface ReportPdfRow {
  guestName: string;
  guestEmail: string;
  roomTypeName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  guests: string;
  total: string;
}

export interface ReportPdfCopy {
  title: string;
  subtitle: string;
  note: string | null;
  thGuest: string;
  thRoom: string;
  thCheckIn: string;
  thCheckOut: string;
  thGuests: string;
  thTotal: string;
  noResults: string;
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#F7F5F0',
    color: '#161616',
    paddingTop: 46,
    paddingBottom: 52,
    paddingHorizontal: 48,
    fontFamily: 'Report Inter',
  },
  header: { borderBottomWidth: 1, borderBottomColor: '#B8603A', paddingBottom: 18, marginBottom: 20 },
  hotel: { fontSize: 13, fontWeight: 600, color: '#161616' },
  logo: { width: 160, height: 44, objectFit: 'contain', objectPosition: 'left' },
  title: { marginTop: 10, fontSize: 26, fontWeight: 600, lineHeight: 1.15 },
  subtitle: { marginTop: 7, fontSize: 10, color: '#66665F' },
  note: { marginTop: 3, fontSize: 9, color: '#66665F' },
  table: { marginTop: 4 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#DDD9D0', paddingVertical: 10, gap: 8 },
  headRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#161616', paddingBottom: 8, gap: 8 },
  th: { fontSize: 8, fontWeight: 600, color: '#66665F' },
  guestCol: { flexBasis: 0, flexGrow: 25 },
  roomCol: { flexBasis: 0, flexGrow: 21 },
  dateCol: { flexBasis: 0, flexGrow: 15 },
  guestsCol: { flexBasis: 0, flexGrow: 11 },
  totalCol: { flexBasis: 0, flexGrow: 13, textAlign: 'right' },
  cell: { fontSize: 9, lineHeight: 1.3 },
  cellMuted: { marginTop: 2, fontSize: 7.5, color: '#66665F' },
  empty: { marginTop: 24, fontSize: 10, color: '#66665F', textAlign: 'center' },
  footer: { position: 'absolute', bottom: 23, left: 48, right: 48, borderTopWidth: 1, borderTopColor: '#DDD9D0', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: '#66665F' },
});

/** Allow long identifiers to wrap inside their own PDF column instead of running into the next one. */
function wrapIdentifier(value: string): string {
  const lines: string[] = [];
  let line = '';
  for (const part of value.match(/[^@._-]+[@._-]?/gu) ?? [value]) {
    for (const chunk of part.match(/.{1,22}/gu) ?? [part]) {
      if (line && line.length + chunk.length > 22) {
        lines.push(line);
        line = '';
      }
      line += chunk;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

/** A4 report for the desk or filing; long rows can flow to another page. */
export function ReportPdf({ hotelName, logoData, copy, rows }: { hotelName: string; logoData?: string | null; copy: ReportPdfCopy; rows: ReportPdfRow[] }) {
  return (
    <Page size="A4" style={styles.page} wrap>
      <View style={styles.header}>
        {logoData ? <Image src={logoData} style={styles.logo} /> : <Text style={styles.hotel}>{hotelName}</Text>}
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>
        {copy.note ? <Text style={styles.note}>{copy.note}</Text> : null}
      </View>

      {rows.length === 0 ? (
        <Text style={styles.empty}>{copy.noResults}</Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.headRow} fixed>
            <Text style={[styles.th, styles.guestCol]}>{copy.thGuest}</Text>
            <Text style={[styles.th, styles.roomCol]}>{copy.thRoom}</Text>
            <Text style={[styles.th, styles.dateCol]}>{copy.thCheckIn}</Text>
            <Text style={[styles.th, styles.dateCol]}>{copy.thCheckOut}</Text>
            <Text style={[styles.th, styles.guestsCol]}>{copy.thGuests}</Text>
            <Text style={[styles.th, styles.totalCol]}>{copy.thTotal}</Text>
          </View>
          {rows.map((row, index) => (
            <View key={`${row.guestEmail}-${index}`} style={styles.row} wrap={false}>
              <View style={styles.guestCol}>
                <Text style={styles.cell}>{row.guestName}</Text>
                <Text style={styles.cellMuted}>{wrapIdentifier(row.guestEmail)}</Text>
              </View>
              <View style={styles.roomCol}>
                <Text style={styles.cell}>{row.roomTypeName}</Text>
                <Text style={styles.cellMuted}>{wrapIdentifier(row.roomNumber)}</Text>
              </View>
              <Text style={[styles.cell, styles.dateCol]}>{row.checkIn}</Text>
              <Text style={[styles.cell, styles.dateCol]}>{row.checkOut}</Text>
              <Text style={[styles.cell, styles.guestsCol]}>{row.guests}</Text>
              <Text style={[styles.cell, styles.totalCol]}>{row.total}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>{hotelName}</Text>
        <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  );
}
