import * as XLSX from 'xlsx';
import { BlockType } from '../models/calendar/CalendarSync';

export const TEMPLATE_HEADERS = [
  'Fecha Inicio',
  'Fecha Fin',
  'Tipo de Bloqueo',
  'Título',
  'Descripción'
] as const;

export const TEMPLATE_FILENAME = 'plantilla-bloqueos.xlsx';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface ParsedBlockRow {
  rowNumber: number;
  startDate: string;
  endDate: string;
  blockType: BlockType;
  title?: string;
  description?: string;
}

export interface RowValidationError {
  rowNumber: number;
  message: string;
}

type RawRow = Record<string, unknown>;

function normalizeHeaderKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, '');
}

function getCell(row: RawRow, ...aliases: string[]): unknown {
  const normalized = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [normalizeHeaderKey(k), v])
  );
  for (const alias of aliases) {
    const val = normalized[normalizeHeaderKey(alias)];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return val;
    }
  }
  return undefined;
}

function excelSerialToDateString(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed) return null;
  const y = parsed.y;
  const m = String(parsed.m).padStart(2, '0');
  const d = String(parsed.d).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateValue(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof value === 'number') {
    return excelSerialToDateString(value);
  }

  const str = String(value).trim();
  if (!str) return null;

  if (DATE_REGEX.test(str)) return str;

  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

function parseBlockType(value: unknown): BlockType {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'external' || normalized === 'externo') {
    return BlockType.ExternalBlock;
  }
  return BlockType.OwnerBlock;
}

function isEmptyRow(row: RawRow): boolean {
  return Object.values(row).every(
    (v) => v === undefined || v === null || String(v).trim() === ''
  );
}

export function parseAvailabilityBlocksWorkbook(buffer: ArrayBuffer): {
  validRows: ParsedBlockRow[];
  errors: RowValidationError[];
} {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { validRows: [], errors: [{ rowNumber: 0, message: 'El archivo no contiene hojas.' }] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '' });

  const validRows: ParsedBlockRow[] = [];
  const errors: RowValidationError[] = [];

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (isEmptyRow(row)) return;

    const startRaw = getCell(row, 'Fecha Inicio', 'FechaInicio', 'StartDate', 'Inicio');
    const endRaw = getCell(row, 'Fecha Fin', 'FechaFin', 'EndDate', 'Fin');
    const blockTypeRaw = getCell(row, 'Tipo de Bloqueo', 'TipoBloqueo', 'Tipo', 'BlockType');
    const titleRaw = getCell(row, 'Título', 'Titulo', 'Title');
    const descriptionRaw = getCell(row, 'Descripción', 'Descripcion', 'Description');

    const startDate = parseDateValue(startRaw);
    const endDate = parseDateValue(endRaw);

    if (!startDate) {
      errors.push({ rowNumber, message: 'Fecha de inicio inválida o vacía (use YYYY-MM-DD).' });
      return;
    }
    if (!endDate) {
      errors.push({ rowNumber, message: 'Fecha de fin inválida o vacía (use YYYY-MM-DD).' });
      return;
    }
    if (endDate < startDate) {
      errors.push({ rowNumber, message: 'La fecha de fin debe ser igual o posterior a la de inicio.' });
      return;
    }

    const blockTypeStr = String(blockTypeRaw ?? '').trim().toLowerCase();
    if (
      blockTypeStr &&
      blockTypeStr !== 'owner' &&
      blockTypeStr !== 'propietario' &&
      blockTypeStr !== 'external' &&
      blockTypeStr !== 'externo'
    ) {
      errors.push({
        rowNumber,
        message: `Tipo de bloqueo no válido: "${blockTypeStr}". Use "propietario" o "externo".`
      });
      return;
    }

    validRows.push({
      rowNumber,
      startDate,
      endDate,
      blockType: parseBlockType(blockTypeRaw),
      title: titleRaw !== undefined && titleRaw !== null ? String(titleRaw).trim() || undefined : undefined,
      description:
        descriptionRaw !== undefined && descriptionRaw !== null
          ? String(descriptionRaw).trim() || undefined
          : undefined
    });
  });

  return { validRows, errors };
}

export function downloadAvailabilityBlocksTemplate(): void {
  const exampleRow = ['2026-07-01', '2026-07-05', 'propietario', 'Mantenimiento', 'Pintura general'];
  const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS.slice(), exampleRow]);
  sheet['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 24 }, { wch: 32 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Bloqueos');

  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = TEMPLATE_FILENAME;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
