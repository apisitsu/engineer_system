-- Migration: Create tooling_formula table
-- Replaces legacy mtc_formulas for the MTC tooling selection formula engine.
-- FormulaService evaluates rows in id ASC order with a shared flat context,
-- so insert order matters when formulas reference each other.

CREATE TABLE IF NOT EXISTS tooling_formula (
    id                 BIGSERIAL    PRIMARY KEY,
    machine_name       VARCHAR(100) NOT NULL,
    tooling_name       VARCHAR(100) NOT NULL,
    parameter_name     VARCHAR(100) NOT NULL,
    formula_type       VARCHAR(50)  NOT NULL DEFAULT 'expression',  -- expression | condition | limit
    formula_value      TEXT         NOT NULL,
    rounding_rule      VARCHAR(20)  NOT NULL DEFAULT 'none',        -- none | ceil | floor | round
    rounding_precision INTEGER               DEFAULT 2,
    remark             TEXT,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tooling_formula_machine
    ON tooling_formula (machine_name);

CREATE INDEX IF NOT EXISTS idx_tooling_formula_machine_tool
    ON tooling_formula (machine_name, tooling_name);

-- Constraint: each (machine, tooling, parameter) should be unique per intent,
-- but not enforced at DB level to allow multiple sequential steps with same param.
-- Order is controlled by id ASC evaluation in FormulaService.

COMMENT ON TABLE tooling_formula IS
    'Dynamic formula engine for MTC tooling selection. Rows are evaluated in id ASC order per machine_name.';
COMMENT ON COLUMN tooling_formula.formula_type IS
    'expression = evaluated and stored in context; limit = skipped (metadata only)';
COMMENT ON COLUMN tooling_formula.rounding_rule IS
    'Applied after evaluation: none | ceil | floor | round';
