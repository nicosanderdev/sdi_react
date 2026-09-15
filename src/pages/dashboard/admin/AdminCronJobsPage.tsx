import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from 'flowbite-react';
import { Loader2Icon, PlayIcon } from 'lucide-react';
import { RunCronJobConfirmModal } from '../../../components/admin/cron/RunCronJobConfirmModal';
import DashboardPageTitle from '../../../components/dashboard/DashboardPageTitle';
import adminCronJobsService, {
  CRON_INVOKE_STILL_RUNNING_CAVEAT,
  extractCronResultErrors,
  summarizeCronResult,
  type AdminCronJobCatalogItem,
} from '../../../services/AdminCronJobsService';

interface RunOutcome {
  jobId: string;
  label: string;
  color: 'success' | 'warning' | 'failure';
  title: string;
  summary: string;
  errors: string[];
  caveat: string | null;
}

function buildOutcome(
  job: AdminCronJobCatalogItem,
  result: Awaited<ReturnType<typeof adminCronJobsService.runJob>>,
): RunOutcome {
  const errors = result.body ? extractCronResultErrors(result.body) : [];
  const summary = result.body
    ? summarizeCronResult(job.id, result.body)
    : result.errorMessage || 'Error al ejecutar el trabajo.';

  if (!result.body) {
    return {
      jobId: job.id,
      label: job.label,
      color: 'failure',
      title: `${job.label}: error al ejecutar`,
      summary,
      errors: [],
      caveat: CRON_INVOKE_STILL_RUNNING_CAVEAT,
    };
  }

  const color: RunOutcome['color'] = result.invokeFailed
    ? 'failure'
    : errors.length > 0
      ? 'warning'
      : 'success';

  return {
    jobId: job.id,
    label: job.label,
    color,
    title: result.invokeFailed ? `${job.label}: finalizó con error` : `${job.label}: completado`,
    summary,
    errors: errors.slice(0, 5),
    caveat: result.mayStillBeRunning ? CRON_INVOKE_STILL_RUNNING_CAVEAT : null,
  };
}

export function AdminCronJobsPage() {
  const [jobs, setJobs] = useState<AdminCronJobCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingJob, setPendingJob] = useState<AdminCronJobCatalogItem | null>(null);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const runningRef = useRef(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const catalog = await adminCronJobsService.listJobs();
      setJobs(catalog);
    } catch (error) {
      setJobs([]);
      setLoadError(
        error instanceof Error ? error.message : 'Error al cargar las ejecuciones recurrentes.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const handleConfirmRun = async () => {
    if (!pendingJob || runningRef.current) return;
    const job = pendingJob;
    runningRef.current = true;
    setRunningJobId(job.id);
    setOutcome(null);

    try {
      const result = await adminCronJobsService.runJob(job.id);
      setOutcome(buildOutcome(job, result));
    } catch (error) {
      setOutcome({
        jobId: job.id,
        label: job.label,
        color: 'failure',
        title: `${job.label}: error al ejecutar`,
        summary: error instanceof Error ? error.message : 'Error al ejecutar el trabajo.',
        errors: [],
        caveat: CRON_INVOKE_STILL_RUNNING_CAVEAT,
      });
    } finally {
      runningRef.current = false;
      setRunningJobId(null);
      setPendingJob(null);
    }
  };

  const running = runningJobId != null;

  return (
    <div className="space-y-6">
      <DashboardPageTitle
        title="Ejecuciones recurrentes"
        subtitle="Dispara los trabajos programados de la plataforma. La ejecución es la misma que el cron: efectos reales."
      />

      {loadError && (
        <Alert color="failure" onDismiss={() => setLoadError(null)}>
          {loadError}
        </Alert>
      )}

      {outcome && (
        <Alert color={outcome.color} onDismiss={() => setOutcome(null)}>
          <p className="font-medium">{outcome.title}</p>
          <p className="mt-1 text-sm">{outcome.summary}</p>
          {outcome.errors.length > 0 && (
            <ul className="mt-2 max-h-32 list-inside list-disc overflow-y-auto text-sm">
              {outcome.errors.map((err, index) => (
                <li key={`${index}-${err}`}>{err}</li>
              ))}
            </ul>
          )}
          {outcome.caveat && <p className="mt-2 text-sm font-medium">{outcome.caveat}</p>}
        </Alert>
      )}

      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : jobs.length === 0 ? (
          <p className="py-8 text-center text-gray-500 dark:text-gray-400">
            No hay trabajos recurrentes disponibles.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table hoverable>
              <TableHead>
                <TableHeadCell>Nombre</TableHeadCell>
                <TableHeadCell>Qué hace</TableHeadCell>
                <TableHeadCell>Ejecutar</TableHeadCell>
              </TableHead>
              <TableBody className="divide-y">
                {jobs.map((job) => {
                  const isThisRunning = runningJobId === job.id;
                  return (
                    <TableRow key={job.id}>
                      <TableCell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                        {job.label}
                      </TableCell>
                      <TableCell className="max-w-xl text-sm text-gray-600 dark:text-gray-400">
                        {job.description}
                      </TableCell>
                      <TableCell className="w-40">
                        <Button
                          color="light"
                          size="sm"
                          disabled={running}
                          onClick={() => setPendingJob(job)}
                          className="flex items-center space-x-2"
                        >
                          {isThisRunning ? (
                            <Loader2Icon className="h-4 w-4 animate-spin" />
                          ) : (
                            <PlayIcon className="h-4 w-4" />
                          )}
                          <span>{isThisRunning ? 'Ejecutando…' : 'Ejecutar'}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <RunCronJobConfirmModal
        job={pendingJob}
        running={running}
        onClose={() => {
          if (!running) setPendingJob(null);
        }}
        onConfirm={() => void handleConfirmRun()}
      />
    </div>
  );
}
