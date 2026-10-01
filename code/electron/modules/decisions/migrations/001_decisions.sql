CREATE TABLE decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  decision_no TEXT,
  decision_date TEXT NOT NULL,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  details TEXT,
  effective_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_dec_emp ON decisions(employee_id, decision_date);