import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Button,
  Label,
  Modal,
  ModalBody,
  ModalHeader,
  Select,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TextInput,
  ToggleSwitch,
} from 'flowbite-react';
import type { PropertyType } from '../../../models/properties/PropertyData';
import {
  listAdminPlans,
  upsertAdminPlan,
  type AdminPlanRow,
  type AdminPlanUpsertPayload,
  type PricingModel,
} from '../../../services/PlansAdminService';

const PRICING_MODELS: PricingModel[] = ['per_booking', 'per_listing', 'hybrid'];

const PROPERTY_TYPES: PropertyType[] = ['RealEstate', 'SummerRent', 'EventVenue'];

const HELPER_TEXT_CLASS = 'mt-1 text-xs text-gray-500 dark:text-gray-300';

type FormState = {
  id?: string;
  key: string;
  name: string;
  currency: string;
  pricingModel: PricingModel;
  price: string;
  monthlyPrice: string;
  minMonthlyFee: string;
  pricePerBooking: string;
  maxProperties: string;
  maxPublishedProperties: string;
  maxUsers: string;
  maxStorageMb: string;
  listingLimit: string;
  bookingLimit: string;
  billingCycle: string;
  durationDays: string;
  commissionPercentage: string;
  commissionMinimumAmount: string;
  extraPropertiesPrice11to30: string;
  extraPropertiesPrice31Plus: string;
  bookingReceiptMinimumAmount: string;
  propertyType: string;
  isActive: boolean;
  isActiveV2: boolean;
  isDeleted: boolean;
};

const emptyForm = (key = ''): FormState => ({
  key,
  name: '',
  currency: 'USD',
  pricingModel: 'hybrid',
  price: '0',
  monthlyPrice: '0',
  minMonthlyFee: '',
  pricePerBooking: '',
  maxProperties: '',
  maxPublishedProperties: '',
  maxUsers: '',
  maxStorageMb: '',
  listingLimit: '',
  bookingLimit: '',
  billingCycle: '30',
  durationDays: '30',
  commissionPercentage: '',
  commissionMinimumAmount: '',
  extraPropertiesPrice11to30: '',
  extraPropertiesPrice31Plus: '',
  bookingReceiptMinimumAmount: '',
  propertyType: '',
  isActive: true,
  isActiveV2: true,
  isDeleted: false,
});

function numToText(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}

function parseOptionalNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const n = parseFloat(trimmed);
  return Number.isNaN(n) ? null : n;
}

function parseRequiredNumber(text: string, fallback = 0): number {
  const n = parseOptionalNumber(text);
  return n ?? fallback;
}

function nextPlanKey(rows: AdminPlanRow[]): number {
  if (rows.length === 0) return 0;
  return Math.max(...rows.map(r => r.key)) + 1;
}

function rowToForm(row: AdminPlanRow): FormState {
  const active = row.isActiveV2 ?? row.isActive;
  return {
    id: row.id,
    key: String(row.key),
    name: row.name,
    currency: row.currency,
    pricingModel: row.pricingModel ?? 'hybrid',
    price: numToText(row.price),
    monthlyPrice: numToText(row.monthlyPrice),
    minMonthlyFee: numToText(row.minMonthlyFee),
    pricePerBooking: numToText(row.pricePerBooking),
    maxProperties: numToText(row.maxProperties),
    maxPublishedProperties: numToText(row.maxPublishedProperties),
    maxUsers: numToText(row.maxUsers),
    maxStorageMb: numToText(row.maxStorageMb),
    listingLimit: numToText(row.listingLimit),
    bookingLimit: numToText(row.bookingLimit),
    billingCycle: numToText(row.billingCycle),
    durationDays: numToText(row.durationDays),
    commissionPercentage: numToText(row.commissionPercentage),
    commissionMinimumAmount: numToText(row.commissionMinimumAmount),
    extraPropertiesPrice11to30: numToText(row.extraPropertiesPrice11to30),
    extraPropertiesPrice31Plus: numToText(row.extraPropertiesPrice31Plus),
    bookingReceiptMinimumAmount: numToText(row.bookingReceiptMinimumAmount),
    propertyType: row.propertyType ?? '',
    isActive: active,
    isActiveV2: active,
    isDeleted: row.isDeleted,
  };
}

function formToPayload(form: FormState): AdminPlanUpsertPayload {
  const propertyType =
    form.propertyType.trim() === '' ? null : (form.propertyType as PropertyType);
  const isActive = form.isActiveV2;

  const payload: AdminPlanUpsertPayload = {
    Name: form.name.trim(),
    Currency: form.currency.trim(),
    PricingModel: form.pricingModel,
    Price: parseOptionalNumber(form.price),
    MonthlyPrice: parseOptionalNumber(form.monthlyPrice),
    MinMonthlyFee: parseOptionalNumber(form.minMonthlyFee),
    PricePerBooking: parseOptionalNumber(form.pricePerBooking),
    MaxProperties: parseOptionalNumber(form.maxProperties),
    MaxPublishedProperties: parseOptionalNumber(form.maxPublishedProperties),
    MaxUsers: parseOptionalNumber(form.maxUsers),
    MaxStorageMb: parseOptionalNumber(form.maxStorageMb),
    ListingLimit: parseOptionalNumber(form.listingLimit),
    BookingLimit: parseOptionalNumber(form.bookingLimit),
    BillingCycle: parseRequiredNumber(form.billingCycle, 30),
    DurationDays: parseRequiredNumber(form.durationDays, 30),
    CommissionPercentage: parseOptionalNumber(form.commissionPercentage),
    CommissionMinimumAmount: parseOptionalNumber(form.commissionMinimumAmount),
    ExtraPropertiesPrice11to30: parseOptionalNumber(form.extraPropertiesPrice11to30),
    ExtraPropertiesPrice31Plus: parseOptionalNumber(form.extraPropertiesPrice31Plus),
    BookingReceiptMinimumAmount: parseOptionalNumber(form.bookingReceiptMinimumAmount),
    PropertyType: propertyType,
    IsActive: isActive,
    IsActiveV2: isActive,
    IsDeleted: form.isDeleted,
  };

  if (form.id) {
    payload.Id = form.id;
  } else {
    payload.Key = parseInt(form.key, 10);
  }

  return payload;
}

function formatPricingSummary(row: AdminPlanRow): string {
  const currency = row.currency?.trim() || '';
  const money = (amount: number) => (currency ? `${amount} ${currency}` : String(amount));
  const parts: string[] = [];
  if (row.price != null) parts.push(`Precio: ${money(row.price)}`);
  if (row.minMonthlyFee != null) parts.push(`Mín: ${money(row.minMonthlyFee)}`);
  if (row.pricePerBooking != null) parts.push(`/reserva: ${money(row.pricePerBooking)}`);
  if (row.commissionPercentage != null) parts.push(`Comisión: ${row.commissionPercentage}%`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded border border-gray-200 p-4 dark:border-gray-700">
      <legend className="px-1 text-lg font-semibold text-gray-800 dark:text-gray-100">{title}</legend>
      {children}
    </fieldset>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  helper,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <TextInput id={id} type="number" step="any" value={value} onChange={e => onChange(e.target.value)} />
      {helper && <p className={HELPER_TEXT_CLASS}>{helper}</p>}
    </div>
  );
}

export function PlansManager() {
  const [rows, setRows] = useState<AdminPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setRows(await listAdminPlans({ includeDeleted }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar planes');
    } finally {
      setLoading(false);
    }
  }, [includeDeleted]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setForm(emptyForm(String(nextPlanKey(rows))));
    setModalOpen(true);
  };

  const openEdit = (row: AdminPlanRow) => {
    setForm(rowToForm(row));
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!form.name.trim()) {
        setError('El nombre es obligatorio');
        return;
      }
      if (!form.id && (form.key.trim() === '' || Number.isNaN(parseInt(form.key, 10)))) {
        setError('No se pudo asignar la clave (Key) del plan');
        return;
      }

      await upsertAdminPlan(formToPayload(form));
      setModalOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const isEdit = Boolean(form.id);
  const isActive = form.isActiveV2;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Catálogo de planes de facturación. La clave (Key) identifica el plan en la app: 0 = Free, 1 =
          Manager Pro, 2 = Company Small.
        </p>
        <div className="flex items-center gap-4">
          <ToggleSwitch
            checked={includeDeleted}
            label="Mostrar eliminados"
            onChange={setIncludeDeleted}
          />
          <Button onClick={openCreate}>Nuevo plan</Button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table striped>
            <TableHead>
              <TableRow>
                <TableHeadCell>Nombre</TableHeadCell>
                <TableHeadCell>Key</TableHeadCell>
                <TableHeadCell>Modelo</TableHeadCell>
                <TableHeadCell>Precios</TableHeadCell>
                <TableHeadCell>Límite listados</TableHeadCell>
                <TableHeadCell>Límite reservas</TableHeadCell>
                <TableHeadCell>Activo</TableHeadCell>
                <TableHeadCell>Tipo propiedad</TableHeadCell>
                <TableHeadCell>Acciones</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.id} className={row.isDeleted ? 'opacity-60' : undefined}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.key}</TableCell>
                  <TableCell>{row.pricingModel ?? '—'}</TableCell>
                  <TableCell className="text-sm">{formatPricingSummary(row)}</TableCell>
                  <TableCell>{row.listingLimit ?? row.maxPublishedProperties ?? '—'}</TableCell>
                  <TableCell>{row.bookingLimit ?? '∞'}</TableCell>
                  <TableCell>{(row.isActiveV2 ?? row.isActive) ? 'Sí' : 'No'}</TableCell>
                  <TableCell>{row.propertyType ?? '—'}</TableCell>
                  <TableCell>
                    <Button size="xs" color="alternative" onClick={() => openEdit(row)}>
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal show={modalOpen} onClose={() => setModalOpen(false)} size="4xl">
        <ModalHeader>{isEdit ? 'Editar plan' : 'Nuevo plan'}</ModalHeader>
        <ModalBody>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <FieldGroup title="Identificación">
              {isEdit && (
                <div>
                  <Label htmlFor="planId">Id (Id)</Label>
                  <TextInput id="planId" value={form.id ?? ''} readOnly disabled />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="planKey">Clave (Key)</Label>
                  <TextInput
                    id="planKey"
                    type="number"
                    value={form.key}
                    readOnly
                    disabled
                  />
                  {!isEdit && (
                    <p className={HELPER_TEXT_CLASS}>
                      Se asigna automáticamente al crear el plan.
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="planName">Nombre (Name)</Label>
                  <TextInput
                    id="planName"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
              </div>
            </FieldGroup>

            <FieldGroup title="Estado">
              <div className="flex flex-wrap gap-6">
                <ToggleSwitch
                  checked={isActive}
                  label="Activo"
                  onChange={checked =>
                    setForm(f => ({ ...f, isActive: checked, isActiveV2: checked }))
                  }
                />
                <ToggleSwitch
                  checked={form.isDeleted}
                  label="Eliminado (IsDeleted)"
                  onChange={checked => setForm(f => ({ ...f, isDeleted: checked }))}
                />
              </div>
            </FieldGroup>

            <FieldGroup title="Precios flexibles">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pricingModel">Modelo de precio (PricingModel)</Label>
                  <Select
                    id="pricingModel"
                    value={form.pricingModel}
                    onChange={e =>
                      setForm(f => ({ ...f, pricingModel: e.target.value as PricingModel }))
                    }
                  >
                    {PRICING_MODELS.map(m => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="currency">Moneda (Currency)</Label>
                  <TextInput
                    id="currency"
                    value={form.currency}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  />
                </div>
                <NumberField
                  id="price"
                  label="Precio (Price)"
                  value={form.price}
                  onChange={v => setForm(f => ({ ...f, price: v }))}
                />
                <NumberField
                  id="monthlyPrice"
                  label="Precio mensual (MonthlyPrice)"
                  value={form.monthlyPrice}
                  onChange={v => setForm(f => ({ ...f, monthlyPrice: v }))}
                />
                <NumberField
                  id="minMonthlyFee"
                  label="Mínimo mensual (MinMonthlyFee)"
                  value={form.minMonthlyFee}
                  onChange={v => setForm(f => ({ ...f, minMonthlyFee: v }))}
                  helper="Vacío = sin mínimo"
                />
                <NumberField
                  id="pricePerBooking"
                  label="Precio por reserva (PricePerBooking)"
                  value={form.pricePerBooking}
                  onChange={v => setForm(f => ({ ...f, pricePerBooking: v }))}
                  helper="Vacío = no aplica"
                />
              </div>
            </FieldGroup>

            <FieldGroup title="Límites">
              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  id="listingLimit"
                  label="Límite de listados (ListingLimit)"
                  value={form.listingLimit}
                  onChange={v => setForm(f => ({ ...f, listingLimit: v }))}
                />
                <NumberField
                  id="bookingLimit"
                  label="Límite de reservas (BookingLimit)"
                  value={form.bookingLimit}
                  onChange={v => setForm(f => ({ ...f, bookingLimit: v }))}
                  helper="Vacío = ilimitado"
                />
                <NumberField
                  id="maxProperties"
                  label="Máx. propiedades (MaxProperties)"
                  value={form.maxProperties}
                  onChange={v => setForm(f => ({ ...f, maxProperties: v }))}
                />
                <NumberField
                  id="maxPublishedProperties"
                  label="Máx. publicadas (MaxPublishedProperties)"
                  value={form.maxPublishedProperties}
                  onChange={v => setForm(f => ({ ...f, maxPublishedProperties: v }))}
                />
                <NumberField
                  id="maxUsers"
                  label="Máx. usuarios (MaxUsers)"
                  value={form.maxUsers}
                  onChange={v => setForm(f => ({ ...f, maxUsers: v }))}
                />
                <NumberField
                  id="maxStorageMb"
                  label="Máx. almacenamiento MB (MaxStorageMb)"
                  value={form.maxStorageMb}
                  onChange={v => setForm(f => ({ ...f, maxStorageMb: v }))}
                />
              </div>
            </FieldGroup>

            <FieldGroup title="Ciclo de facturación">
              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  id="durationDays"
                  label="Duración en días (DurationDays)"
                  value={form.durationDays}
                  onChange={v => setForm(f => ({ ...f, durationDays: v }))}
                />
                <NumberField
                  id="billingCycle"
                  label="Ciclo de facturación (BillingCycle)"
                  value={form.billingCycle}
                  onChange={v => setForm(f => ({ ...f, billingCycle: v }))}
                />
              </div>
            </FieldGroup>

            <FieldGroup title="Comisión y extras">
              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  id="commissionPercentage"
                  label="Comisión % (CommissionPercentage)"
                  value={form.commissionPercentage}
                  onChange={v => setForm(f => ({ ...f, commissionPercentage: v }))}
                />
                <NumberField
                  id="commissionMinimumAmount"
                  label="Comisión mínima (CommissionMinimumAmount)"
                  value={form.commissionMinimumAmount}
                  onChange={v => setForm(f => ({ ...f, commissionMinimumAmount: v }))}
                />
                <NumberField
                  id="extraPropertiesPrice11to30"
                  label="Extra propiedades 11–30 (ExtraPropertiesPrice11to30)"
                  value={form.extraPropertiesPrice11to30}
                  onChange={v => setForm(f => ({ ...f, extraPropertiesPrice11to30: v }))}
                />
                <NumberField
                  id="extraPropertiesPrice31Plus"
                  label="Extra propiedades 31+ (ExtraPropertiesPrice31Plus)"
                  value={form.extraPropertiesPrice31Plus}
                  onChange={v => setForm(f => ({ ...f, extraPropertiesPrice31Plus: v }))}
                />
                <NumberField
                  id="bookingReceiptMinimumAmount"
                  label="Mín. recibo reserva (BookingReceiptMinimumAmount)"
                  value={form.bookingReceiptMinimumAmount}
                  onChange={v => setForm(f => ({ ...f, bookingReceiptMinimumAmount: v }))}
                />
              </div>
            </FieldGroup>

            <FieldGroup title="Ámbito">
              <div>
                <Label htmlFor="propertyType">Tipo de propiedad (PropertyType)</Label>
                <Select
                  id="propertyType"
                  value={form.propertyType}
                  onChange={e => setForm(f => ({ ...f, propertyType: e.target.value }))}
                >
                  <option value="">— Sin restricción —</option>
                  {PROPERTY_TYPES.map(pt => (
                    <option key={pt} value={pt}>
                      {pt}
                    </option>
                  ))}
                </Select>
              </div>
            </FieldGroup>

            <div className="flex justify-end gap-2 pt-2">
              <Button color="alternative" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </div>
  );
}
