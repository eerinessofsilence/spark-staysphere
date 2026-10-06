import { describe, expect, it } from 'vitest';
import { mergeDocumentRecognitions, recognizeDocumentText } from './document-mrz';

const passport = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10';
describe('document OCR/MRZ', () => {
  it('reads TD3 identity and check digits; leaves absent issue date blank', () => {
    const result = recognizeDocumentText(passport, 95);
    expect(result.fields).toMatchObject({ firstName: 'ANNA MARIA', lastName: 'ERIKSSON', dateOfBirth: '1974-08-12', documentNumber: 'L898902C3', issuingCountry: 'UTO', nationality: 'UTO', gender: 'F', expirationDate: '2012-04-15', issueDate: '' });
    expect(result.confidence.documentNumber).toBeGreaterThan(0.9);
  });
  it('flags damaged check digits and recognizes TD1', () => {
    expect(recognizeDocumentText(passport.replace('L898902C36', 'L898902C30')).confidence.documentNumber).toBeLessThan(0.5);
    const result = recognizeDocumentText('I<UTOD231458907<<<<<<<<<<<<<<<\n7408122F1204159UTO<<<<<<<<<<<6\nERIKSSON<<ANNA<MARIA<<<<<<<<<<<');
    // Clipped filler characters do not invalidate the readable identity fields.
    expect(result.fields.documentNumber).toBe('D23145890');
    const valid = recognizeDocumentText(['I<UTOD231458907<<<<<<<<<<<<<<<', '7408122F1204159UTO<<<<<<<<<<<6', 'ERIKSSON<<ANNA<MARIA<<<<<<<<<<'].join('\n'), 90);
    expect(valid.fields).toMatchObject({ documentType: 'id', firstName: 'ANNA MARIA', documentNumber: 'D23145890' });
  });
  it('supports printed fields without inventing absent values', () => {
    const result = recognizeDocumentText('Surname: SAMPLE\nGiven names: TEST PERSON\nDate of issue: 27.09.2026\nDocument Number: FAKE123');
    expect(result.fields).toMatchObject({ lastName: 'SAMPLE', firstName: 'TEST PERSON', issueDate: '2026-09-27', documentNumber: 'FAKE123', nationality: '' });
    expect(result.confidence.issueDate).toBeLessThan(0.8);
  });
  it('reads passport rows with clipped fillers, extra OCR punctuation and blank lines', () => {
    const result = recognizeDocumentText('P«UTOERIKSSON««ANNA«MARIA«««\n\nL898902C36UTO7408122F1204159\n', 85);
    expect(result.fields).toMatchObject({ firstName: 'ANNA MARIA', lastName: 'ERIKSSON', documentNumber: 'L898902C3', dateOfBirth: '1974-08-12', expirationDate: '2012-04-15' });
    expect(result.confidence.documentNumber).toBe(0.98);
  });
  it('repairs OCR letters only in numeric MRZ positions and checks the repaired date', () => {
    const result = recognizeDocumentText(passport.replace('7408122F1204159', '74O8I22FI2O4I59'), 80);
    expect(result.fields).toMatchObject({ dateOfBirth: '1974-08-12', expirationDate: '2012-04-15', documentNumber: 'L898902C3' });
    expect(result.confidence.dateOfBirth).toBe(0.98);
  });
  it('reads names from an isolated first MRZ row without inventing the missing data row', () => {
    const result = recognizeDocumentText('P<UTOERIKSSON<<ANNA<MARIA<<<', 85);
    expect(result.fields).toMatchObject({ firstName: 'ANNA MARIA', lastName: 'ERIKSSON', issuingCountry: 'UTO', documentNumber: '', dateOfBirth: '' });
  });
  it('prefers a printed name when OCR turned the MRZ filler run into repeated letters', () => {
    const result = recognizeDocumentText('Given names: ANNA MARIA\nP<UTOERIKSSON<<ANNA<KMARIAKLLLLLLLLLLLLLLLLL\nL898902C36UTO7408122F1204159', 85);
    expect(result.fields.firstName).toBe('ANNA MARIA');
    expect(result.confidence.firstName).toBe(0.5);
  });
  it('recovers a verified numeric MRZ row and merges it with names from another pass', () => {
    const names = recognizeDocumentText('P<UTOERIKSSON<<ANNA<MARIA<<<', 85);
    const numeric = recognizeDocumentText('L898902C36UTO7408122F1204159', 85);
    expect(numeric.fields).toMatchObject({ firstName: '', lastName: '', issuingCountry: '', documentNumber: 'L898902C3', nationality: 'UTO' });
    expect(mergeDocumentRecognitions(names, numeric).fields).toMatchObject({ firstName: 'ANNA MARIA', lastName: 'ERIKSSON', issuingCountry: 'UTO', dateOfBirth: '1974-08-12' });
  });
  it('reads bilingual printed labels and rejects impossible dates', () => {
    const result = recognizeDocumentText('Прізвище / Surname\nSAMPLE\nІм’я / Given names\nTEST PERSON\nDocument Number TEST123\nDate of issue: 31.02.2020', 80);
    expect(result.fields).toMatchObject({ lastName: 'SAMPLE', firstName: 'TEST PERSON', documentNumber: 'TEST123', issueDate: '' });
  });
  it('merges OCR passes without erasing fields or downgrading checksum-verified values', () => {
    const first = recognizeDocumentText(`${passport}\nDate of issue: 01.01.2000`, 95);
    const second = recognizeDocumentText('Document Number: WRONG123\nGiven names: ANNA', 80);
    const result = mergeDocumentRecognitions(first, second, recognizeDocumentText(''));
    expect(result.fields).toMatchObject({ documentNumber: 'L898902C3', firstName: 'ANNA MARIA', issueDate: '2000-01-01' });
    expect(result.confidence.documentNumber).toBe(0.98);
  });
});
