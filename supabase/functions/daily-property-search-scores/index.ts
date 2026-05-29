/**
 * Daily batch: precompute portal search scores (PropertySearchScores).
 * Invoke via POST (Supabase Scheduled Functions or external cron).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type BatchRow = {
  estate_property_id: string;
  listing_type: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const startTime = Date.now();
  let processed = 0;
  let succeeded = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const batchSize =
      typeof body.batchSize === 'number' && body.batchSize > 0 ? body.batchSize : undefined;

    let batchLimit = batchSize ?? 100;
    if (!batchSize) {
      const { data: params, error: paramsErr } = await supabase.rpc('get_app_parameters', {
        p_site_scope: 'global',
      });
      if (!paramsErr && params && typeof params === 'object') {
        const raw = (params as Record<string, unknown>).SEARCH_CRON_BATCH_SIZE;
        if (typeof raw === 'number' && raw > 0) batchLimit = raw;
      }
    }

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error: batchErr } = await supabase.rpc(
        'cron_property_search_scores_batch',
        { p_offset: offset, p_limit: batchLimit },
      );

      if (batchErr) {
        throw new Error(`cron_property_search_scores_batch: ${batchErr.message}`);
      }

      const rows = (batch ?? []) as BatchRow[];
      if (rows.length === 0) {
        hasMore = false;
        break;
      }

      for (const row of rows) {
        processed++;
        try {
          const { data: result, error: computeErr } = await supabase.rpc(
            'compute_property_search_scores',
            {
              p_estate_property_id: row.estate_property_id,
              p_listing_type: row.listing_type,
            },
          );

          if (computeErr) {
            throw computeErr;
          }

          if (result && typeof result === 'object' && (result as { skipped?: boolean }).skipped) {
            skipped++;
          } else {
            succeeded++;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push(`${row.estate_property_id}/${row.listing_type}: ${msg}`);
        }
      }

      offset += rows.length;
      if (rows.length < batchLimit) {
        hasMore = false;
      }

      if (body.maxBatches && typeof body.maxBatches === 'number' && offset / batchLimit >= body.maxBatches) {
        hasMore = false;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        succeeded,
        skipped,
        errors: errors.slice(0, 50),
        errorCount: errors.length,
        durationMs: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        processed,
        succeeded,
        skipped,
        errors: errors.slice(0, 50),
        durationMs: Date.now() - startTime,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
