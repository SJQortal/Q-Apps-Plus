/**
 * Text files shown in Open File's viewer, made readable: a CSV or TSV file
 * as a table, and binary data as hex rows. Pure.
 */

export interface Table {
  rows: string[][];
  /** More rows followed than `maxRows`. */
  truncated: boolean;
  delimiter: ',' | ';' | '\t';
}

/** The delimiter a table's first line uses most: tab, semicolon or comma. */
export function guessDelimiter(text: string): ',' | ';' | '\t' {
  const line = text.slice(0, text.search(/\r?\n|$/));
  const count = (char: string) => line.split(char).length - 1;
  const tabs = count('\t');
  const semicolons = count(';');
  const commas = count(',');
  if (tabs > 0 && tabs >= commas && tabs >= semicolons) return '\t';
  if (semicolons > commas) return ';';
  return ',';
}

/**
 * Rows of a CSV or TSV text, as spreadsheets read them: quoted cells may
 * hold the delimiter, line breaks and doubled quotes. At most `maxRows`;
 * a last line cut off by a partial read is dropped when `partial`.
 */
export function parseTable(
  text: string,
  options: { maxRows: number; partial?: boolean; delimiter?: ',' | ';' | '\t' }
): Table {
  const delimiter = options.delimiter ?? guessDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let i = 0;
  // A byte order mark isn't part of the first cell.
  if (text.charCodeAt(0) === 0xfeff) i = 1;
  const endRow = () => {
    row.push(cell);
    rows.push(row);
    row = [];
    cell = '';
  };
  for (; i < text.length && rows.length <= options.maxRows; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"' && cell === '') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      endRow();
    } else cell += char;
  }
  const ended = i >= text.length;
  // What is left after the last line break: a row of its own, unless the read cut it.
  if (ended && (cell !== '' || row.length) && !options.partial) endRow();
  const truncated = rows.length > options.maxRows || !ended || Boolean(options.partial);
  return { rows: rows.slice(0, options.maxRows), truncated, delimiter };
}

export interface HexRow {
  /** Where the row starts, as 8 hex digits. */
  offset: string;
  /** Its bytes in hex, 16 to a row, a wider gap after the eighth. */
  hex: string;
  /** The same bytes as characters, a dot for each that isn't printable ASCII. */
  text: string;
}

/** Bytes as rows of a hex dump, 16 a row, offsets counted from `start`. */
export function hexRows(bytes: Uint8Array, start = 0): HexRow[] {
  const rows: HexRow[] = [];
  for (let at = 0; at < bytes.length; at += 16) {
    const chunk = bytes.subarray(at, at + 16);
    const pairs = Array.from(chunk, (byte) => byte.toString(16).padStart(2, '0'));
    rows.push({
      offset: (start + at).toString(16).padStart(8, '0'),
      hex: [pairs.slice(0, 8).join(' '), pairs.slice(8).join(' ')].filter(Boolean).join('  '),
      text: Array.from(chunk, (byte) =>
        byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : '.'
      ).join(''),
    });
  }
  return rows;
}
