-- ============================================================
-- 005: Finance Token Optimization
-- Migración para el sistema de gestión financiera y
-- optimización de consumo de tokens.
--
-- Uso: Ejecutar contra la base de datos Supabase del proyecto.
--   Puede ejecutarse manualmente desde el SQL Editor de Supabase
--   o mediante el script: node scripts/run-managed.cjs
--
-- Alteraciones:
--   - ai_usage_logs: columnas cost_usd, company_id,
--     complexity_level, complexity_score, model_selection_reason
--
-- Nuevas tablas:
--   - model_routing_rules:  Reglas de enrutamiento de modelos por tarea/agente/complejidad
--   - quality_metrics:      Métricas de calidad por proveedor/modelo/agente/tarea
--   - optimization_config:  Configuración global de estrategia de optimización
--
-- Relaciones:
--   - ai_usage_logs.company_id → companies.id (SET NULL)
--   - optimization_config.updated_by → auth.users.id
--
-- Políticas RLS: Permisivas (allow all) para todas las tablas nuevas.
-- ============================================================

-- ============================================================
-- 1. ALTER ai_usage_logs — Add finance & optimization columns
-- Req: 8.1
-- ============================================================
ALTER TABLE ai_usage_logs
  ADD COLUMN IF NOT EXISTS cost_usd DECIMAL(10,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS complexity_level VARCHAR(20),
  ADD COLUMN IF NOT EXISTS complexity_score DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS model_selection_reason TEXT;

-- Índices para nuevas columnas de ai_usage_logs
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_company_id ON ai_usage_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_cost ON ai_usage_logs(cost_usd);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_complexity ON ai_usage_logs(complexity_level);

-- ============================================================
-- 2. Nueva tabla: model_routing_rules
-- Define el modelo preferido por combinación tarea/agente/complejidad.
-- Columnas clave:
--   task_type            — Tipo de tarea IA (chat, map, validate, correct, full-analysis)
--   agent_name           — Nombre del agente (auditor, writer, corrector, mapper, etc.)
--   complexity_level     — Nivel de complejidad (simple, moderate, complex)
--   preferred_provider_type / preferred_model_id — Modelo preferido
--   max_cost_per_1k_tokens — Límite de costo por 1K tokens
--   min_quality_score    — Umbral mínimo de calidad (0–1)
-- Constraint UNIQUE(task_type, agent_name, complexity_level) evita duplicados.
-- Req: 8.2, 8.3, 8.4
-- ============================================================
CREATE TABLE IF NOT EXISTS model_routing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type VARCHAR(50) NOT NULL,
    agent_name VARCHAR(50) NOT NULL,
    complexity_level VARCHAR(20) NOT NULL,
    preferred_provider_type VARCHAR(20) NOT NULL,
    preferred_model_id VARCHAR(100) NOT NULL,
    max_cost_per_1k_tokens DECIMAL(10,6) NOT NULL DEFAULT 0.01,
    min_quality_score DECIMAL(3,2) NOT NULL DEFAULT 0.7,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_complexity CHECK (complexity_level IN ('simple', 'moderate', 'complex')),
    CONSTRAINT valid_quality CHECK (min_quality_score BETWEEN 0 AND 1),
    UNIQUE(task_type, agent_name, complexity_level)
);

CREATE INDEX IF NOT EXISTS idx_routing_rules_lookup
    ON model_routing_rules(task_type, agent_name, complexity_level, is_active);

-- ============================================================
-- 3. Nueva tabla: quality_metrics
-- Registra historial de calidad por proveedor/modelo/agente/tarea.
-- Columnas clave:
--   success_rate     — Tasa de éxito (0.0000–1.0000)
--   avg_latency_ms   — Latencia promedio en milisegundos
--   sample_count     — Cantidad de muestras acumuladas
-- Constraint UNIQUE(provider_type, model_id, agent_name, task_type).
-- Req: 8.5
-- ============================================================
CREATE TABLE IF NOT EXISTS quality_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_type VARCHAR(20) NOT NULL,
    model_id VARCHAR(100) NOT NULL,
    agent_name VARCHAR(50) NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    success_rate DECIMAL(5,4) NOT NULL DEFAULT 1.0,
    avg_latency_ms INT NOT NULL DEFAULT 0,
    sample_count INT NOT NULL DEFAULT 0,
    last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(provider_type, model_id, agent_name, task_type)
);

CREATE INDEX IF NOT EXISTS idx_quality_metrics_lookup
    ON quality_metrics(provider_type, model_id, agent_name, task_type);

-- ============================================================
-- 4. Nueva tabla: optimization_config
-- Configuración global de estrategia de optimización.
-- Columnas clave:
--   strategy              — 'cost-first' | 'quality-first' | 'balanced'
--   cost_weight / quality_weight — Pesos del score compuesto (deben sumar 1.0)
--   max_cost_per_task_usd — Límite de costo por tarea en USD
--   min_quality_threshold — Umbral mínimo de calidad (0–1)
--   enable_auto_routing   — Habilita/deshabilita enrutamiento automático
--   updated_by            — FK a auth.users.id (quién modificó la config)
-- Req: 8.6, 8.7, 8.8
-- ============================================================
CREATE TABLE IF NOT EXISTS optimization_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy VARCHAR(20) NOT NULL DEFAULT 'balanced',
    cost_weight DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    quality_weight DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    max_cost_per_task_usd DECIMAL(10,4) NOT NULL DEFAULT 0.50,
    min_quality_threshold DECIMAL(3,2) NOT NULL DEFAULT 0.7,
    enable_auto_routing BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id),
    CONSTRAINT valid_strategy CHECK (strategy IN ('cost-first', 'quality-first', 'balanced')),
    CONSTRAINT valid_weights CHECK (cost_weight + quality_weight = 1.0),
    CONSTRAINT valid_threshold CHECK (min_quality_threshold BETWEEN 0 AND 1)
);

-- ============================================================
-- 5. Datos iniciales: optimization_config
-- Inserta configuración balanceada por defecto.
-- ============================================================
INSERT INTO optimization_config (strategy, cost_weight, quality_weight, max_cost_per_task_usd, min_quality_threshold, enable_auto_routing)
VALUES ('balanced', 0.5, 0.5, 0.50, 0.7, true);

-- ============================================================
-- 6. Row Level Security — Políticas permisivas para tablas nuevas
-- ============================================================

-- model_routing_rules RLS
ALTER TABLE model_routing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access" ON model_routing_rules;
CREATE POLICY "Allow all access" ON model_routing_rules
    FOR ALL USING (true) WITH CHECK (true);

-- quality_metrics RLS
ALTER TABLE quality_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access" ON quality_metrics;
CREATE POLICY "Allow all access" ON quality_metrics
    FOR ALL USING (true) WITH CHECK (true);

-- optimization_config RLS
ALTER TABLE optimization_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access" ON optimization_config;
CREATE POLICY "Allow all access" ON optimization_config
    FOR ALL USING (true) WITH CHECK (true);
