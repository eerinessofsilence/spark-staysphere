import * as React from 'react';
import { Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { MenuPdfCopy, MenuPdfItem } from './menu-pdf-button';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#F7F5F0',
    color: '#161616',
    paddingTop: 46,
    paddingBottom: 52,
    paddingHorizontal: 48,
    fontFamily: 'Helvetica',
  },
  header: { borderBottomWidth: 1, borderBottomColor: '#B8603A', paddingBottom: 18, marginBottom: 24 },
  hotel: { fontSize: 10, color: '#66665F', letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { marginTop: 8, fontFamily: 'Times-Roman', fontSize: 34, lineHeight: 1.08 },
  subtitle: { marginTop: 7, fontSize: 10, color: '#66665F' },
  qrSection: { alignItems: 'center', marginBottom: 30, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#DDD9D0' },
  qrImage: { width: 220, height: 220 },
  qrPrompt: { marginTop: 5, fontSize: 11, fontWeight: 700 },
  qrUrl: { marginTop: 5, maxWidth: 490, fontSize: 8, lineHeight: 1.3, color: '#66665F', textAlign: 'center' },
  item: { marginBottom: 18, flexDirection: 'row', gap: 14 },
  itemPhoto: { width: 96, height: 76, objectFit: 'cover' },
  itemBody: { flexGrow: 1, flexShrink: 1 },
  category: { marginBottom: 4, fontSize: 7.5, color: '#66665F' },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  itemName: { flexGrow: 1, flexShrink: 1, fontFamily: 'Times-Roman', fontSize: 16, lineHeight: 1.15 },
  price: { fontSize: 10, fontWeight: 700, textAlign: 'right' },
  unit: { marginTop: 3, fontSize: 8, color: '#66665F', textAlign: 'right' },
  description: { marginTop: 5, maxWidth: 420, fontSize: 9, lineHeight: 1.45, color: '#55554F' },
  extrasLabel: { marginTop: 7, fontSize: 8, fontWeight: 700, color: '#9A4E2C' },
  extraRow: { marginTop: 4, flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  extraName: { flexGrow: 1, flexShrink: 1, fontSize: 8.5 },
  extraDescription: { marginTop: 2, fontSize: 7.5, lineHeight: 1.35, color: '#66665F' },
  extraPrice: { fontSize: 8.5, fontWeight: 700, textAlign: 'right' },
  footer: { position: 'absolute', bottom: 23, left: 48, right: 48, borderTopWidth: 1, borderTopColor: '#DDD9D0', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: '#66665F' },
});

export function DiningMenuPdf({
  hotelName,
  items,
  copy,
  menuUrl,
  qrImage,
}: {
  hotelName: string;
  items: MenuPdfItem[];
  copy: MenuPdfCopy;
  menuUrl: string;
  qrImage: string;
}) {
  return (
    <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.hotel}>{hotelName}</Text>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>
        </View>

        <View style={styles.qrSection} wrap={false}>
          <Image src={qrImage} style={styles.qrImage} />
          <Text style={styles.qrPrompt}>{pdfText(copy.qrPrompt)}</Text>
          <Text style={styles.qrUrl}>{menuUrl}</Text>
        </View>

        {items.map((item, index) => (
          <View key={`${item.name}-${index}`} style={styles.item} wrap={false}>
            {item.photo ? <Image src={item.photo} style={styles.itemPhoto} /> : null}
            <View style={styles.itemBody}>
            <Text style={styles.category}>{pdfText(item.categoryLabel)}</Text>
            <View style={styles.itemHead}>
              <Text style={styles.itemName}>{pdfText(item.name)}</Text>
              <View>
                <Text style={styles.price}>{pdfText(item.price)}</Text>
                <Text style={styles.unit}>{pdfText(item.unit)}</Text>
              </View>
            </View>
            {item.description ? <Text style={styles.description}>{pdfText(item.description)}</Text> : null}
            {item.extras.length ? (
              <View>
                <Text style={styles.extrasLabel}>{copy.extras}</Text>
                {item.extras.map((extra, extraIndex) => (
                  <View key={`${extra.name}-${extraIndex}`} style={styles.extraRow}>
                    <View style={{ flexGrow: 1, flexShrink: 1 }}>
                      <Text style={styles.extraName}>{pdfText(extra.name)}</Text>
                      {extra.description ? <Text style={styles.extraDescription}>{pdfText(extra.description)}</Text> : null}
                    </View>
                    <Text style={styles.extraPrice}>
                      {pdfText(extra.price)} <Text style={{ color: '#66665F', fontWeight: 400 }}>({pdfText(extra.unit)})</Text>
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            </View>
          </View>
        ))}

        <View fixed style={styles.footer}>
          <Text style={styles.footerText}>{hotelName}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `${copy.page} ${pageNumber} / ${totalPages}`}
          />
        </View>
    </Page>
  );
}

function pdfText(value: string): string {
  // The menu descriptions are content; normalize typographic dashes so the
  // exported copy stays compatible with standard PDF fonts.
  return value.replace(/[\u2010-\u2015\u2212]/g, '-');
}
