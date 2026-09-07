export type VisitsReportCsvRow = {
  propertyTitle: string;
  address?: string;
  status?: string;
  price?: string;
  visitCount: number;
  messages?: number;
  conversion?: string;
};

export type VisitsReportCsvInput = {
  generatedAt: Date;
  periodLabel: string;
  scopeLabel: string;
  totalVisits: number;
  totalMessages: number;
  totalProperties: number;
  daily: { date: string; visits: number }[];
  sources: { source: string; visits: number }[];
  properties: VisitsReportCsvRow[];
};

function csvEscape(value: string | number | undefined | null): string {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function formatVisitsReportFilename(generatedAt: Date = new Date()): string {
  const year = generatedAt.getFullYear();
  const month = String(generatedAt.getMonth() + 1).padStart(2, '0');
  const day = String(generatedAt.getDate()).padStart(2, '0');
  return `visitas-${year}-${month}-${day}.csv`;
}

export function buildVisitsReportCsv(input: VisitsReportCsvInput): string {
  const lines: string[] = [];

  lines.push('Reporte de visitas');
  lines.push(`Generado,${csvEscape(input.generatedAt.toISOString())}`);
  lines.push(`Periodo,${csvEscape(input.periodLabel)}`);
  lines.push(`Alcance,${csvEscape(input.scopeLabel)}`);
  lines.push('');
  lines.push('Resumen');
  lines.push('Metrica,Valor');
  lines.push(`Visitas totales,${csvEscape(input.totalVisits)}`);
  lines.push(`Consultas recibidas,${csvEscape(input.totalMessages)}`);
  lines.push(`Propiedades,${csvEscape(input.totalProperties)}`);
  lines.push('');
  lines.push('Visitas por propiedad');
  lines.push('Propiedad,Direccion,Estado,Precio,Visitas,Mensajes,Conversion');
  for (const row of input.properties) {
    lines.push(
      [
        csvEscape(row.propertyTitle),
        csvEscape(row.address),
        csvEscape(row.status),
        csvEscape(row.price),
        csvEscape(row.visitCount),
        csvEscape(row.messages ?? 0),
        csvEscape(row.conversion),
      ].join(','),
    );
  }
  lines.push('');
  lines.push('Visitas por fuente');
  lines.push('Fuente,Visitas');
  for (const row of input.sources) {
    lines.push(`${csvEscape(row.source)},${csvEscape(row.visits)}`);
  }
  lines.push('');
  lines.push('Visitas por dia');
  lines.push('Fecha,Visitas');
  for (const row of input.daily) {
    lines.push(`${csvEscape(row.date)},${csvEscape(row.visits)}`);
  }

  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function downloadVisitsReportCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
