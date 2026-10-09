/** One CSV cell, safe to open in a spreadsheet: quotes doubled and the cell
 *  quoted (a name with a comma or a quote can't break the row), and text that
 *  starts like a formula (= + - @, tab, return) prefixed with ' so Excel and
 *  Sheets show it instead of running it. */
export function csvCell(value: unknown): string {
  let text = value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Rows of cells → CSV text (CRLF, as spreadsheets expect). */
export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
