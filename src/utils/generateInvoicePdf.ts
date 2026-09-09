import { jsPDF } from 'jspdf';

export type InvoicePdfUsageLine = {
  type: string;
  amount: number;
  createdAt: Date;
};

export type InvoicePdfInput = {
  invoiceId: string;
  billedTo: string;
  createdAt: Date;
  dueDate?: Date | null;
  paidAt?: Date | null;
  status: string;
  total: number;
  lines: InvoicePdfUsageLine[];
};

const CURRENCY = 'UYU';

const formatMoney = (amount: number): string =>
  `${CURRENCY} ${amount.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value: Date): string =>
  value.toLocaleDateString('es-UY', { year: 'numeric', month: 'short', day: 'numeric' });

const usageLabel = (type: string): string => {
  if (type === 'booking') return 'Reserva';
  if (type === 'listing') return 'Publicacion';
  return type;
};

const statusLabel = (status: string): string => {
  if (status === 'paid' || status === '0') return 'Pagada';
  if (status === 'pending' || status === '1') return 'Pendiente';
  return status;
};

export function generateInvoicePdfBlob(input: InvoicePdfInput): Blob {
  const doc = new jsPDF();
  const shortId = input.invoiceId.replace(/-/g, '').slice(0, 8).toUpperCase();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Comprobante', 20, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`N. ${shortId}`, 20, 30);
  doc.text('SomosDI', 20, 38);

  let y = 52;
  doc.setFont('helvetica', 'bold');
  doc.text('Facturado a', 20, y);
  doc.setFont('helvetica', 'normal');
  y += 8;
  doc.text(input.billedTo || '—', 20, y);

  y += 14;
  doc.text(`Fecha: ${formatDate(input.createdAt)}`, 20, y);
  y += 7;
  if (input.dueDate) {
    doc.text(`Vencimiento: ${formatDate(input.dueDate)}`, 20, y);
    y += 7;
  }
  if (input.paidAt) {
    doc.text(`Pagado: ${formatDate(input.paidAt)}`, 20, y);
    y += 7;
  }
  doc.text(`Estado: ${statusLabel(input.status)}`, 20, y);

  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.text('Detalle', 20, y);
  y += 8;
  doc.setFont('helvetica', 'normal');

  if (input.lines.length === 0) {
    doc.text('Sin renglones de uso. Se informa el total de la factura.', 20, y);
    y += 10;
  } else {
    doc.setFontSize(10);
    doc.text('Concepto', 20, y);
    doc.text('Fecha', 90, y);
    doc.text('Importe', 160, y);
    y += 6;
    doc.setLineWidth(0.2);
    doc.line(20, y, 190, y);
    y += 8;

    for (const line of input.lines) {
      if (y > 270) {
        doc.addPage();
        y = 24;
      }
      doc.text(usageLabel(line.type), 20, y);
      doc.text(formatDate(line.createdAt), 90, y);
      doc.text(formatMoney(line.amount), 160, y);
      y += 7;
    }
  }

  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Total: ${formatMoney(input.total)}`, 20, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Este documento es un comprobante interno. No es una factura fiscal.', 20, 285);

  return doc.output('blob');
}
