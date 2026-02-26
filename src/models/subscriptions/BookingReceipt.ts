/**
 * Booking receipt status (matches DB integer).
 * 0 = pending, 1 = paid, 2 = overdue
 */
export enum BookingReceiptStatus {
  Pending = 0,
  Paid = 1,
  Overdue = 2
}

export interface BookingReceipt {
  id: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  dueDate: Date;
  paidAt: Date | null;
  status: BookingReceiptStatus;
  createdAt: Date;
  lastModified: Date;
}

export interface BookingReceiptItem {
  id: string;
  bookingReceiptId: string;
  bookingId: string;
  amount: number;
  created: Date;
}

export interface BookingReceiptWithItems extends BookingReceipt {
  items?: BookingReceiptItem[];
}
