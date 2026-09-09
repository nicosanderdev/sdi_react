import { test, expect } from '@playwright/test';
import { readFile } from 'fs/promises';
import { loginAsCredentials } from './utils/auth.setup';
import { createSupabaseServiceClient } from './utils/supabase-service';
import { cleanupManagerPanel, seedManagerPanel } from './fixtures/manager-panel-seed';

test.describe('Manager panel reports', () => {
  test('company manager can view visit stats and export CSV', async ({ page }, testInfo) => {
    const supabase = createSupabaseServiceClient();
    const seed = await seedManagerPanel(supabase);

    try {
      await loginAsCredentials(page, seed.manager.email, seed.manager.password);
      await page.goto('/dashboard/reports', { waitUntil: 'load' });

      await expect(page.getByRole('heading', { name: 'Reportes y Métricas' })).toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId('report-total-visits-value')).toHaveText(String(seed.visitCount), { timeout: 20000 });
      await expect(page.getByTestId('properties-performance-table')).toBeVisible();
      await expect(page.getByText(seed.propertyTitle)).toBeVisible();

      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('export-visits-csv').click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/^visitas-\d{4}-\d{2}-\d{2}\.csv$/);

      const csvPath = testInfo.outputPath(download.suggestedFilename());
      await download.saveAs(csvPath);
      const csv = await readFile(csvPath, 'utf8');
      expect(csv).toContain('Reporte de visitas');
      expect(csv).toContain('Visitas totales');
      expect(csv).toContain(String(seed.visitCount));
      expect(csv).toContain(seed.propertyTitle);
      expect(csv).toContain('Visitas por fuente');
      expect(csv).toContain('Visitas por dia');
    } finally {
      await cleanupManagerPanel(supabase, seed);
    }
  });
});
