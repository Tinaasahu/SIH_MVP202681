-- Supabase PostgreSQL Schema for Hybrid AI–NWP Forecast System
-- Smart India Hackathon 2026 (PS: 26081)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/pwtukbopowxejquoyxbr/sql/new

-- ============================================================================
-- 1. CORE DATABASE TABLES (From database/weather.db)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.forecast_current (
    id BIGSERIAL PRIMARY KEY,
    city TEXT NOT NULL,
    model TEXT NOT NULL,
    datetime TEXT NOT NULL,
    temperature REAL,
    rainfall REAL,
    wind_speed REAL
);

CREATE TABLE IF NOT EXISTS public.actual_history (
    id BIGSERIAL PRIMARY KEY,
    city TEXT NOT NULL,
    datetime TEXT NOT NULL,
    actual_temperature REAL,
    actual_rainfall REAL,
    actual_wind REAL
);

CREATE TABLE IF NOT EXISTS public.forecast_history (
    id BIGSERIAL PRIMARY KEY,
    city TEXT NOT NULL,
    model TEXT NOT NULL,
    datetime TEXT NOT NULL,
    temperature REAL,
    rainfall REAL,
    wind_speed REAL
);

CREATE TABLE IF NOT EXISTS public.forecast_history_lead (
    id BIGSERIAL PRIMARY KEY,
    city TEXT NOT NULL,
    model TEXT NOT NULL,
    datetime TEXT NOT NULL,
    lead_days INTEGER NOT NULL,
    temperature REAL,
    rainfall REAL,
    wind_speed REAL
);

-- ============================================================================
-- 2. AI PIPELINE OUTPUT TABLES (From outputs/*.csv)
-- ============================================================================

DROP TABLE IF EXISTS public.hybrid_forecast;
CREATE TABLE public.hybrid_forecast (
    id BIGSERIAL PRIMARY KEY,
    city TEXT NOT NULL,
    datetime TEXT NOT NULL,
    lead_days INTEGER NOT NULL,
    blend_temperature REAL,
    blend_rainfall REAL,
    blend_wind_speed REAL,
    temperature REAL,
    rainfall REAL,
    wind_speed REAL
);

DROP TABLE IF EXISTS public.confidence_scores;
CREATE TABLE public.confidence_scores (
    id BIGSERIAL PRIMARY KEY,
    city TEXT NOT NULL,
    datetime TEXT NOT NULL,
    lead_day INTEGER,
    confidence REAL,
    confidence_label TEXT,
    skill_score REAL,
    agreement_score REAL,
    lead_score REAL,
    dominant_model TEXT,
    explanation TEXT
);

DROP TABLE IF EXISTS public.extreme_alerts;
CREATE TABLE public.extreme_alerts (
    id BIGSERIAL PRIMARY KEY,
    city TEXT NOT NULL,
    datetime TEXT NOT NULL,
    event TEXT,
    severity TEXT,
    forecast_value REAL,
    threshold REAL
);

DROP TABLE IF EXISTS public.model_weights_lead;
CREATE TABLE public.model_weights_lead (
    id BIGSERIAL PRIMARY KEY,
    city TEXT NOT NULL,
    variable TEXT NOT NULL,
    lead_days INTEGER NOT NULL,
    model TEXT NOT NULL,
    weight REAL
);

DROP TABLE IF EXISTS public.skill_scores_lead;
CREATE TABLE public.skill_scores_lead (
    id BIGSERIAL PRIMARY KEY,
    city TEXT NOT NULL,
    variable TEXT NOT NULL,
    lead_days INTEGER NOT NULL,
    model TEXT NOT NULL,
    mae REAL,
    rmse REAL,
    bias REAL,
    n INTEGER
);

-- ============================================================================
-- 3. HIGH PERFORMANCE QUERY INDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_fc_city_dt ON public.forecast_current (city, datetime);
CREATE INDEX IF NOT EXISTS idx_fc_model ON public.forecast_current (model);

CREATE INDEX IF NOT EXISTS idx_ah_city_dt ON public.actual_history (city, datetime);

CREATE INDEX IF NOT EXISTS idx_fh_city_dt ON public.forecast_history (city, datetime);
CREATE INDEX IF NOT EXISTS idx_fh_model ON public.forecast_history (model);

CREATE INDEX IF NOT EXISTS idx_fhl_city_dt ON public.forecast_history_lead (city, datetime);
CREATE INDEX IF NOT EXISTS idx_fhl_lead ON public.forecast_history_lead (lead_days);

CREATE INDEX IF NOT EXISTS idx_hf_city_dt ON public.hybrid_forecast (city, datetime);
CREATE INDEX IF NOT EXISTS idx_cs_city_dt ON public.confidence_scores (city, datetime);
CREATE INDEX IF NOT EXISTS idx_ea_city_dt ON public.extreme_alerts (city, datetime);
CREATE INDEX IF NOT EXISTS idx_mw_city ON public.model_weights_lead (city, variable, lead_days);
CREATE INDEX IF NOT EXISTS idx_ss_city ON public.skill_scores_lead (city, variable, lead_days);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) & PUBLIC READ POLICIES
-- ============================================================================

ALTER TABLE public.forecast_current ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actual_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_history_lead ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hybrid_forecast ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confidence_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extreme_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_weights_lead ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_scores_lead ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on forecast_current" ON public.forecast_current FOR SELECT USING (true);
CREATE POLICY "Allow public read on actual_history" ON public.actual_history FOR SELECT USING (true);
CREATE POLICY "Allow public read on forecast_history" ON public.forecast_history FOR SELECT USING (true);
CREATE POLICY "Allow public read on forecast_history_lead" ON public.forecast_history_lead FOR SELECT USING (true);
CREATE POLICY "Allow public read on hybrid_forecast" ON public.hybrid_forecast FOR SELECT USING (true);
CREATE POLICY "Allow public read on confidence_scores" ON public.confidence_scores FOR SELECT USING (true);
CREATE POLICY "Allow public read on extreme_alerts" ON public.extreme_alerts FOR SELECT USING (true);
CREATE POLICY "Allow public read on model_weights_lead" ON public.model_weights_lead FOR SELECT USING (true);
CREATE POLICY "Allow public read on skill_scores_lead" ON public.skill_scores_lead FOR SELECT USING (true);

CREATE POLICY "Allow full access for service role on forecast_current" ON public.forecast_current FOR ALL USING (true);
CREATE POLICY "Allow full access for service role on actual_history" ON public.actual_history FOR ALL USING (true);
CREATE POLICY "Allow full access for service role on forecast_history" ON public.forecast_history FOR ALL USING (true);
CREATE POLICY "Allow full access for service role on forecast_history_lead" ON public.forecast_history_lead FOR ALL USING (true);
CREATE POLICY "Allow full access for service role on hybrid_forecast" ON public.hybrid_forecast FOR ALL USING (true);
CREATE POLICY "Allow full access for service role on confidence_scores" ON public.confidence_scores FOR ALL USING (true);
CREATE POLICY "Allow full access for service role on extreme_alerts" ON public.extreme_alerts FOR ALL USING (true);
CREATE POLICY "Allow full access for service role on model_weights_lead" ON public.model_weights_lead FOR ALL USING (true);
CREATE POLICY "Allow full access for service role on skill_scores_lead" ON public.skill_scores_lead FOR ALL USING (true);
