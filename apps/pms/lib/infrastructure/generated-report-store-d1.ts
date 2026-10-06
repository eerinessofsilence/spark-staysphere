import type { GeneratedReport, GeneratedReportKind, GeneratedReportRow, GeneratedRoomTypeRow, GeneratedStatisticsRow } from '../domain/ports';
import { ensureSchema } from './d1-schema';

/**
 * D1-backed half of `GeneratedReportStore`. Everything past the report's own
 * identity — the period's end date and whichever of `rows`/`roomTypeRows`/
 * `statisticsRows` its kind populated — lives in one JSON blob in the `rows`
 * column, the same shape `catalog_entries.data` uses: a generated report is
 * read back whole or not at all, never queried by a field inside it.
 */

interface GeneratedReportRowD1 {
  id: string;
  hotel_id: string;
  type: GeneratedReportKind;
  date: string;
  generated_at: string;
  generated_by: string;
  rows: string;
}

interface GeneratedReportPayload {
  to?: string;
  rows: GeneratedReportRow[];
  roomTypeRows?: GeneratedRoomTypeRow[];
  statisticsRows?: GeneratedStatisticsRow[];
}

function rowToReport(row: GeneratedReportRowD1): GeneratedReport {
  const parsed = JSON.parse(row.rows) as GeneratedReportPayload | GeneratedReportRow[];
  // A report saved before period views existed has a bare row array in this column, not the envelope below.
  const payload: GeneratedReportPayload = Array.isArray(parsed) ? { rows: parsed } : parsed;
  return {
    id: row.id,
    hotelId: row.hotel_id,
    type: row.type,
    date: row.date,
    to: payload.to,
    generatedAt: row.generated_at,
    generatedBy: row.generated_by,
    rows: payload.rows,
    roomTypeRows: payload.roomTypeRows,
    statisticsRows: payload.statisticsRows,
  };
}

export async function list(db: D1Database, hotelId: string): Promise<GeneratedReport[]> {
  await ensureSchema(db);
  const { results } = await db
    .prepare(
      'SELECT id, hotel_id, type, date, generated_at, generated_by, rows FROM generated_reports WHERE hotel_id = ? ORDER BY generated_at DESC',
    )
    .bind(hotelId)
    .all<GeneratedReportRowD1>();
  return results.map(rowToReport);
}

export async function get(db: D1Database, hotelId: string, id: string): Promise<GeneratedReport | null> {
  await ensureSchema(db);
  const row = await db
    .prepare('SELECT id, hotel_id, type, date, generated_at, generated_by, rows FROM generated_reports WHERE hotel_id = ? AND id = ?')
    .bind(hotelId, id)
    .first<GeneratedReportRowD1>();
  return row ? rowToReport(row) : null;
}

export async function save(db: D1Database, report: GeneratedReport): Promise<void> {
  await ensureSchema(db);
  const payload: GeneratedReportPayload = {
    to: report.to,
    rows: report.rows,
    roomTypeRows: report.roomTypeRows,
    statisticsRows: report.statisticsRows,
  };
  await db
    .prepare(
      `INSERT INTO generated_reports (id, hotel_id, type, date, generated_at, generated_by, rows) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET type = excluded.type, date = excluded.date, generated_at = excluded.generated_at, generated_by = excluded.generated_by, rows = excluded.rows`,
    )
    .bind(report.id, report.hotelId, report.type, report.date, report.generatedAt, report.generatedBy, JSON.stringify(payload))
    .run();
}
