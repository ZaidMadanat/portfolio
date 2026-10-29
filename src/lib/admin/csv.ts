// CSV for admin exports (RFC 4180: CRLF rows, fields quoted when they hold a
// comma, quote or line break). Values that start like a spreadsheet formula
// get a leading apostrophe, so opening the file never runs anything.

const FORMULA_START = /^[=+\-@\t\r]/;

function field(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(field).join(",") + "\r\n").join("");
}

export const SUBSCRIBER_CSV_HEADER = ["email", "status", "createdAt"];

export type SubscriberCsvRow = { email: string; status: string; createdAt: Date };

/** The subscribers export: `email,status,createdAt`, timestamps in ISO 8601 UTC. */
export function subscribersCsv(rows: SubscriberCsvRow[]): string {
  return toCsv([SUBSCRIBER_CSV_HEADER, ...rows.map((r) => [r.email, r.status, r.createdAt.toISOString()])]);
}
