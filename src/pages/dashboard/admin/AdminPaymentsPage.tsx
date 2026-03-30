import { useEffect } from 'react';
import { Card, TabItem, Tabs } from 'flowbite-react';
import DashboardPageTitle from '../../../components/dashboard/DashboardPageTitle';
import { useAdminPayments } from '../../../hooks/useAdminPayments';
import { BookingsReceiptGenerationSection } from '../../../components/admin/payments/BookingsReceiptGenerationSection';
import { ReceiptsManagementSection } from '../../../components/admin/payments/ReceiptsManagementSection';

export function AdminPaymentsPage() {
  const {
    activeSection,
    setActiveSection,
    filters,
    updateFilters,
    resetFilters,
    bookings,
    receipts,
    loadingBookings,
    loadingReceipts,
    submittingReceipt,
    updatingReceiptId,
    bookingsError,
    receiptsError,
    totalToCollect,
    allFilteredBookingsUnpaid,
    loadBookings,
    loadReceipts,
    generateReceipt,
    setReceiptStatus
  } = useAdminPayments();

  useEffect(() => {
    loadBookings();
    loadReceipts();
  }, [loadBookings, loadReceipts]);

  return (
    <div className="space-y-6" data-testid="admin-payments-page">
      <DashboardPageTitle
        title="Gestión de pagos"
        subtitle="Genera recibos desde reservas y administra su seguimiento de cobro."
      />

      <Card>
        <Tabs
          onActiveTabChange={(activeTab) =>
            setActiveSection(activeTab === 0 ? 'bookings' : 'receipts')
          }
        >
          <TabItem active={activeSection === 'bookings'} title="Reservas (Generación de recibos)">
            <BookingsReceiptGenerationSection
              userSearch={filters.userSearch}
              paymentStatus={filters.paymentStatus}
              fromDate={filters.fromDate}
              toDate={filters.toDate}
              bookings={bookings}
              loading={loadingBookings}
              error={bookingsError}
              totalToCollect={totalToCollect}
              canGenerateReceipt={bookings.length > 0 && allFilteredBookingsUnpaid}
              submittingReceipt={submittingReceipt}
              onChangeFilter={updateFilters}
              onResetFilters={resetFilters}
              onApplyFilters={loadBookings}
              onGenerateReceipt={generateReceipt}
            />
          </TabItem>

          <TabItem active={activeSection === 'receipts'} title="Recibos (Gestión y seguimiento)">
            <ReceiptsManagementSection
              receipts={receipts}
              loading={loadingReceipts}
              error={receiptsError}
              updatingReceiptId={updatingReceiptId}
              onRefresh={loadReceipts}
              onUpdateStatus={setReceiptStatus}
            />
          </TabItem>
        </Tabs>
      </Card>
    </div>
  );
}
