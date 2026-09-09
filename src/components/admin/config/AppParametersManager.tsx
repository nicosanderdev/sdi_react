import { useCallback, useEffect, useState } from 'react';
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
  Textarea,
  ToggleSwitch,
} from 'flowbite-react';
import {
  listAppParameters,
  softDeleteAppParameter,
  upsertAppParameter,
  type AppParameterRow,
  type AppParameterSiteScope,
  type AppParameterType,
} from '../../../services/AppParametersService';
import { clearAppParametersCache } from '../../../services/pricing/fetchParameters';

const PARAMETER_TYPES: AppParameterType[] = [
  'number',
  'boolean',
  'string',
  'json',
  'date',
  'date_range',
];

const SITE_SCOPES: AppParameterSiteScope[] = ['global', 'SummerRent', 'EventVenue'];

type FormState = {
  id?: string;
  name: string;
  parameterType: AppParameterType;
  valueText: string;
  siteScope: AppParameterSiteScope;
  description: string;
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  name: '',
  parameterType: 'string',
  valueText: '',
  siteScope: 'global',
  description: '',
  isActive: true,
});

function valueToText(row: AppParameterRow): string {
  if (row.parameterType === 'json') {
    return JSON.stringify(row.value, null, 2);
  }
  if (typeof row.value === 'string') {
    return row.value.replace(/^"|"$/g, '');
  }
  return String(row.value ?? '');
}

function parseValue(type: AppParameterType, text: string): unknown {
  if (type === 'number') return parseFloat(text);
  if (type === 'boolean') return text === 'true' || text === '1';
  if (type === 'json') return JSON.parse(text);
  return text;
}

export function AppParametersManager() {
  const [rows, setRows] = useState<AppParameterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setRows(await listAppParameters());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar parámetros');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (row: AppParameterRow) => {
    setForm({
      id: row.id,
      name: row.name,
      parameterType: row.parameterType,
      valueText: valueToText(row),
      siteScope: row.siteScope,
      description: row.description ?? '',
      isActive: row.isActive,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const value = parseValue(form.parameterType, form.valueText);
      await upsertAppParameter({
        id: form.id,
        name: form.name.toUpperCase().replace(/\s+/g, '_'),
        parameterType: form.parameterType,
        value,
        siteScope: form.siteScope,
        description: form.description || null,
        isActive: form.isActive,
      });
      clearAppParametersCache();
      setModalOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: AppParameterRow) => {
    if (!window.confirm(`¿Eliminar el parámetro ${row.name}?`)) return;
    try {
      await softDeleteAppParameter(row.id);
      clearAppParametersCache();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Factores de precio dinámico (temporada, anticipación, demanda, etc.). Los nombres en
          MAYÚSCULAS son usados por el código.
        </p>
        <Button onClick={openCreate}>Nuevo parámetro</Button>
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
                <TableHeadCell>Tipo</TableHeadCell>
                <TableHeadCell>Ámbito</TableHeadCell>
                <TableHeadCell>Activo</TableHeadCell>
                <TableHeadCell>Acciones</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-sm">{row.name}</TableCell>
                  <TableCell>{row.parameterType}</TableCell>
                  <TableCell>{row.siteScope}</TableCell>
                  <TableCell>{row.isActive ? 'Sí' : 'No'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="xs"
                        color="alternative"
                        onClick={() => openEdit(row)}
                      >
                        Editar
                      </Button>
                      <Button
                        size="xs"
                        color="red"
                        outline
                        onClick={() => void handleDelete(row)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal show={modalOpen} onClose={() => setModalOpen(false)} size="lg">
        <ModalHeader>{form.id ? 'Editar parámetro' : 'Nuevo parámetro'}</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <Label htmlFor="paramName">Nombre (código)</Label>
              <TextInput
                id="paramName"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="SEASON_FACTOR_LOW"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="paramType">Tipo</Label>
                <Select
                  id="paramType"
                  value={form.parameterType}
                  onChange={e =>
                    setForm(f => ({ ...f, parameterType: e.target.value as AppParameterType }))
                  }
                >
                  {PARAMETER_TYPES.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="paramScope">Ámbito</Label>
                <Select
                  id="paramScope"
                  value={form.siteScope}
                  onChange={e =>
                    setForm(f => ({ ...f, siteScope: e.target.value as AppParameterSiteScope }))
                  }
                >
                  {SITE_SCOPES.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="paramValue">Valor</Label>
              {form.parameterType === 'json' ? (
                <Textarea
                  id="paramValue"
                  rows={8}
                  className="font-mono text-sm"
                  value={form.valueText}
                  onChange={e => setForm(f => ({ ...f, valueText: e.target.value }))}
                />
              ) : (
                <TextInput
                  id="paramValue"
                  value={form.valueText}
                  onChange={e => setForm(f => ({ ...f, valueText: e.target.value }))}
                />
              )}
            </div>
            <div>
              <Label htmlFor="paramDesc">Descripción</Label>
              <TextInput
                id="paramDesc"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <ToggleSwitch
              checked={form.isActive}
              label="Activo"
              onChange={checked => setForm(f => ({ ...f, isActive: checked }))}
            />
            <div className="flex justify-end gap-2">
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
