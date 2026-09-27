import { describe, expect, it } from 'vitest';
import { recognizeDocumentText } from './document-mrz';

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
    // ICAO records must have their full fixed widths; a truncated scan is not guessed.
    expect(result.fields.documentNumber).toBe('');
    const valid = recognizeDocumentText(['I<UTOD231458907<<<<<<<<<<<<<<<', '7408122F1204159UTO<<<<<<<<<<<6', 'ERIKSSON<<ANNA<MARIA<<<<<<<<<<'].join('\n'), 90);
    expect(valid.fields).toMatchObject({ documentType: 'id', firstName: 'ANNA MARIA', documentNumber: 'D23145890' });
  });
  it('supports printed fields without inventing absent values', () => {
    const result = recognizeDocumentText('Surname: SAMPLE\nGiven names: TEST PERSON\nDate of issue: 27.09.2026\nDocument Number: FAKE123');
    expect(result.fields).toMatchObject({ lastName: 'SAMPLE', firstName: 'TEST PERSON', issueDate: '2026-09-27', documentNumber: 'FAKE123', nationality: '' });
    expect(result.confidence.issueDate).toBeLessThan(0.8);
  });
});
