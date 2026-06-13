CREATE TABLE IF NOT EXISTS mtc_formula_error_log (
    id SERIAL PRIMARY KEY,
    cn VARCHAR(20),
    machine_id INT,
    tooling_name VARCHAR(100),
    output_key VARCHAR(5),
    phase VARCHAR(20), -- 'condition' or 'formula'
    expression TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_empno VARCHAR(20)
);

CREATE INDEX IF NOT EXISTS idx_mtc_formula_error_log_cn ON mtc_formula_error_log(cn);
CREATE INDEX IF NOT EXISTS idx_mtc_formula_error_log_created_at ON mtc_formula_error_log(created_at);
