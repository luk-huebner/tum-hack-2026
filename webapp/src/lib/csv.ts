// Reading a list of creators for a campaign: one X handle per line (commas and semicolons work too), or a CSV with a handle column.
// Pure functions, no DOM: the Brand page uses them and cardano/test/csv.test.ts checks them.

export const MAX_CREATORS = 50; // the service's limit for one import
export const HANDLE = /^[A-Za-z0-9_]{1,15}$/; // what X allows, and what the service accepts

/** "@Anna", "https://x.com/anna", '"anna"' become "Anna". No validation. */
export const normalizeHandle = (raw: string): string => {
  let value = raw.trim().replace(/^["']+|["']+$/g, "").trim();
  const url = /^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/@?([^/?#\s]+)/i.exec(value);
  if (url) value = url[1];
  return value.replace(/^@+/, "");
};

export interface CreatorList {
  /** Valid, without duplicates, in the order given (the first spelling of a handle wins). */
  handles: string[];
  /** Entries that are not an X handle. */
  invalid: string[];
  /** Entries that repeat an earlier handle (case does not matter). */
  duplicates: string[];
}

/** Entries are separated by new lines, commas, semicolons or tabs, not by spaces: "Anna Smith" is one entry and it is not a handle. */
export const parseCreatorList = (text: string): CreatorList => {
  const handles: string[] = [];
  const invalid: string[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();
  for (const part of text.split(/[\r\n,;\t]+/)) {
    if (part.trim() === "") continue;
    const handle = normalizeHandle(part);
    if (!HANDLE.test(handle)) {
      invalid.push(part.trim());
      continue;
    }
    const key = handle.toLowerCase();
    if (seen.has(key)) {
      duplicates.push(handle);
      continue;
    }
    seen.add(key);
    handles.push(handle);
  }
  return { handles, invalid, duplicates };
};

const HEADERS = ["handle", "x_handle", "x handle", "x-handle", "twitter", "twitter_handle", "twitter handle", "creator", "creators", "username", "account", "influencer", "x"];

/** Splits CSV text into rows of cells: quotes, doubled quotes inside quotes, and the delimiter that the first line uses (comma, semicolon or tab). */
export const parseCsvRows = (text: string): string[][] => {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = ([",", ";", "\t"] as const).reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
};

/** The handles of a CSV: the column whose header names a handle (the header row is then skipped), otherwise the first column of every row. */
export const extractHandleColumn = (csv: string): { values: string[]; column?: string; rows: number } => {
  const rows = parseCsvRows(csv);
  if (rows.length === 0) return { values: [], rows: 0 };
  const header = rows[0].map((c) => c.trim().toLowerCase());
  const index = header.findIndex((h) => HEADERS.includes(h));
  if (index >= 0) return { values: rows.slice(1).map((r) => (r[index] ?? "").trim()).filter(Boolean), column: rows[0][index].trim(), rows: rows.length - 1 };
  return { values: rows.map((r) => (r[0] ?? "").trim()).filter(Boolean), rows: rows.length };
};
