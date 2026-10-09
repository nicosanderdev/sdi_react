import { useEffect, useState } from 'react';
import { Alert, Button, Card, Label, TextInput } from 'flowbite-react';
import {
  CancellationPolicyService,
  DEFAULT_CANCELLATION_POLICY,
  type CancellationPolicy,
} from '../../../services/CancellationPolicyService';

interface CancellationPolicyEditorProps {
  propertyId: string;
}

export function CancellationPolicyEditor({ propertyId }: CancellationPolicyEditorProps) {
  const [policy, setPolicy] = useState<CancellationPolicy>({ ...DEFAULT_CANCELLATION_POLICY });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const p = await CancellationPolicyService.getForProperty(propertyId);
        if (!cancelled) setPolicy(p);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const next = await CancellationPolicyService.upsertForProperty(propertyId, policy);
      setPolicy(next);
      setSavedMsg('Política de cancelación guardada.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-gray-600 dark:text-gray-300">Cargando política de cancelación…</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Política de cancelación y seña
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Una sola política por propiedad (válida para todos los tipos de anuncio).
            Se aplicó un valor por defecto; revisala y ajustala.
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-200 mt-2">
            {CancellationPolicyService.summarizeEs(policy)}
          </p>
        </div>

        {error && <Alert color="failure">{error}</Alert>}
        {savedMsg && <Alert color="success">{savedMsg}</Alert>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="freeDays">Días de cancelación (antes del check-in)</Label>
            <TextInput
              id="freeDays"
              type="number"
              min={0}
              value={policy.freeCancellationDays}
              onChange={(e) =>
                setPolicy((p) => ({
                  ...p,
                  freeCancellationDays: Math.max(0, parseInt(e.target.value, 10) || 0),
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="refundBefore">% reembolso antes del límite</Label>
            <TextInput
              id="refundBefore"
              type="number"
              min={0}
              max={100}
              value={policy.refundPercentBefore}
              onChange={(e) =>
                setPolicy((p) => ({
                  ...p,
                  refundPercentBefore: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)),
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="refundAfter">% reembolso después del límite</Label>
            <TextInput
              id="refundAfter"
              type="number"
              min={0}
              max={100}
              value={policy.refundPercentAfter}
              onChange={(e) =>
                setPolicy((p) => ({
                  ...p,
                  refundPercentAfter: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)),
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="deposit">% seña (adelanto)</Label>
            <TextInput
              id="deposit"
              type="number"
              min={1}
              max={100}
              value={policy.depositPercent}
              onChange={(e) => {
                const depositPercent = Math.min(100, Math.max(1, parseFloat(e.target.value) || 100));
                setPolicy((p) => ({
                  ...p,
                  depositPercent,
                  balanceDueDays:
                    depositPercent >= 100 ? null : (p.balanceDueDays ?? 7),
                }));
              }}
            />
          </div>
          {policy.depositPercent < 100 && (
            <div>
              <Label htmlFor="balanceDays">Días antes del check-in para el saldo</Label>
              <TextInput
                id="balanceDays"
                type="number"
                min={0}
                value={policy.balanceDueDays ?? 7}
                onChange={(e) =>
                  setPolicy((p) => ({
                    ...p,
                    balanceDueDays: Math.max(0, parseInt(e.target.value, 10) || 0),
                  }))
                }
              />
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar política'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
