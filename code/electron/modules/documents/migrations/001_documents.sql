CREATE TABLE employee_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('general','leave_form','decision','import_source')),
  related_leave_id INTEGER REFERENCES leave_requests(id) ON DELETE SET NULL,
  related_decision_id INTEGER REFERENCES decisions(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  file_size INTEGER,
  page_count INTEGER,
  added_via TEXT NOT NULL DEFAULT 'upload' CHECK (added_via IN ('upload','folder_scan')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (employee_id, relative_path)
);

CREATE INDEX idx_docs_emp ON employee_documents(employee_id, category);