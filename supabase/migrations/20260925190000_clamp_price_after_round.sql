-- Clamp nightly price after commercial rounding so MinPrice/MaxPrice win
-- over rounding modes that can push below the floor (e.g. ending_99).

CREATE OR REPLACE FUNCTION public.pricing_compute_nightly(
  p_listing_id uuid,
  p_base_price numeric,
  p_min_price numeric,
  p_max_price numeric,
  p_date date,
  p_params jsonb,
  p_search_date date DEFAULT CURRENT_DATE
) RETURNS numeric
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
declare
  v_raw numeric;
  v_season numeric;
  v_special numeric;
  v_demand numeric;
  v_anticipation numeric := 1.0;
  v_days_until integer;
  v_round_mode text;
begin
  if p_base_price is null or p_base_price <= 0 then
    return null;
  end if;

  v_season := public.pricing_resolve_season_factor(p_params, p_date);
  v_special := public.pricing_resolve_special_factor(p_params, p_date);
  v_demand := public.pricing_resolve_demand_factor(p_listing_id, p_date);

  v_days_until := p_date - coalesce(p_search_date, current_date);
  if v_days_until >= public.pricing_param_number(p_params, 'ANTICIPATION_MIN_DAYS', 30)::integer then
    v_anticipation := public.pricing_param_number(p_params, 'ANTICIPATION_MULTIPLIER', 0.95);
  end if;

  v_raw := p_base_price * v_season * v_special * v_demand * v_anticipation;
  v_round_mode := coalesce(p_params ->> 'PRICE_ROUNDING_MODE', 'tens');
  v_raw := public.pricing_commercial_round(v_raw, v_round_mode);
  return public.pricing_clamp(v_raw, p_min_price, p_max_price);
end;
$$;
