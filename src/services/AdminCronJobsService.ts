import { supabase } from '../config/supabase';

export const CRON_INVOKE_STILL_RUNNING_CAVEAT =
  'El trabajo puede seguir ejecutándose en el servidor; no vuelvas a dispararlo a ciegas.';

export interface AdminCronJobCatalogItem {
  id: string;
  label: string;
  description: string;
}

export interface CronJobRunResult {
  body: Record<string, unknown> | null;
  invokeFailed: boolean;
  errorMessage: string | null;
  mayStillBeRunning: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseInvokeBody(data: unknown): Record<string, unknown> | null {
  if (isRecord(data)) return data;
  if (typeof data === 'string') {
    try {
      const parsed: unknown = JSON.parse(data);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function bodyFromInvokeError(error: unknown): Promise<Record<string, unknown> | null> {
  if (!error || typeof error !== 'object' || !('context' in error)) return null;
  const response = (error as { context?: Response }).context;
  if (!response || typeof response.clone !== 'function') return null;
  try {
    const json: unknown = await response.clone().json();
    return isRecord(json) ? json : null;
  } catch {
    try {
      const text = await response.clone().text();
      return parseInvokeBody(text);
    } catch {
      return null;
    }
  }
}

function isTimeoutOrNetworkError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('abort')
  );
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

function durationSuffix(body: Record<string, unknown>): string {
  const ms =
    typeof body.durationMs === 'number'
      ? body.durationMs
      : typeof body.totalDuration === 'number'
        ? body.totalDuration
        : null;
  return ms == null ? '' : ` · Duración: ${formatDuration(ms)}`;
}

export function summarizeCronResult(jobId: string, body: Record<string, unknown>): string {
  const duration = durationSuffix(body);

  switch (jobId) {
    case 'receipts-generate':
      return `Ciclos: ${body.cyclesProcessed ?? '—'} · Facturas creadas: ${body.invoicesCreated ?? '—'}${duration}`;
    case 'flexible-invoice-overdue-unpublish':
      return `Facturas revisadas: ${body.invoicesReviewed ?? '—'} · Sujetos vencidos: ${body.overdueSubjects ?? '—'} · Sujetos afectados: ${body.subjectsAffected ?? '—'} · Anuncios despublicados: ${body.listingsUpdated ?? '—'}${duration}`;
    case 'daily-property-search-scores':
      return `Procesados: ${body.processed ?? '—'} · Correctos: ${body.succeeded ?? '—'} · Omitidos: ${body.skipped ?? '—'} · Errores: ${body.errorCount ?? (Array.isArray(body.errors) ? body.errors.length : 0)}${duration}`;
    case 'ical-scheduled-sync': {
      const processed = Number(body.integrationsProcessed ?? 0);
      const skipNote =
        processed === 0
          ? ' Si se sincronizaron hace menos de 30 minutos, el cron las omite.'
          : '';
      return `Integraciones: ${processed} · Correctas: ${body.successfulSyncs ?? '—'} · Fallidas: ${body.failedSyncs ?? '—'} · Eventos: ${body.totalEventsProcessed ?? '—'}${duration}.${skipNote}`;
    }
    default:
      return duration ? duration.replace(/^ · /, '') : 'Ejecución finalizada.';
  }
}

export function extractCronResultErrors(body: Record<string, unknown>): string[] {
  if (Array.isArray(body.errors)) {
    return body.errors.filter((item): item is string => typeof item === 'string');
  }
  if (typeof body.error === 'string' && body.error.trim()) {
    return [body.error];
  }
  if (Array.isArray(body.results)) {
    return body.results.flatMap((item) => {
      if (!isRecord(item) || typeof item.error !== 'string' || !item.error.trim()) return [];
      return [item.error];
    });
  }
  return [];
}

class AdminCronJobsService {
  async listJobs(): Promise<AdminCronJobCatalogItem[]> {
    const { data, error } = await supabase.functions.invoke('admin-run-cron', {
      method: 'GET',
    });

    const body = (parseInvokeBody(data) ?? (await bodyFromInvokeError(error))) as
      | { jobs?: AdminCronJobCatalogItem[]; error?: string }
      | null;

    if (body?.jobs && Array.isArray(body.jobs)) {
      return body.jobs.filter(
        (job) =>
          job &&
          typeof job.id === 'string' &&
          typeof job.label === 'string' &&
          typeof job.description === 'string',
      );
    }

    if (error) {
      throw new Error(
        (typeof body?.error === 'string' && body.error) ||
          error.message ||
          'No se pudo cargar el catálogo de trabajos. Compruebe que admin-run-cron está desplegada.',
      );
    }

    throw new Error(body?.error || 'Respuesta inválida del catálogo de trabajos.');
  }

  async runJob(jobId: string): Promise<CronJobRunResult> {
    const { data, error } = await supabase.functions.invoke('admin-run-cron', {
      body: { job: jobId },
    });

    const body = parseInvokeBody(data) ?? (await bodyFromInvokeError(error));
    const invokeFailed = Boolean(error) || body?.success === false;

    if (!body && error) {
      return {
        body: null,
        invokeFailed: true,
        errorMessage: error.message || 'Error al ejecutar el trabajo.',
        mayStillBeRunning: true,
      };
    }

    return {
      body,
      invokeFailed,
      errorMessage: (typeof body?.error === 'string' && body.error) || error?.message || null,
      mayStillBeRunning: Boolean(error && isTimeoutOrNetworkError(error.message)),
    };
  }
}

const adminCronJobsService = new AdminCronJobsService();
export default adminCronJobsService;
