PRAGMA foreign_keys = ON;

CREATE TABLE departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  job_title TEXT,
  hire_date TEXT NOT NULL,
  birth_date TEXT,
  national_id TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','resigned','terminated','suspended')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE leave_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  yearly_entitlement REAL,
  deducts_balance INTEGER NOT NULL DEFAULT 1,
  counts_weekends INTEGER NOT NULL DEFAULT 0,
  requires_attachment INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE leave_balances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
  year INTEGER NOT NULL,
  entitlement REAL NOT NULL,
  carried_over REAL NOT NULL DEFAULT 0,
  adjustment REAL NOT NULL DEFAULT 0,
  UNIQUE (employee_id, leave_type_id, year)
);

CREATE TABLE leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days REAL NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  decided_at TEXT,
  decided_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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

CREATE TABLE holidays (
  date TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL CHECK (source_type IN ('excel','pdf')),
  file_name TEXT NOT NULL,
  rows_total INTEGER, rows_inserted INTEGER, rows_updated INTEGER, rows_skipped INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL, entity_id INTEGER, action TEXT NOT NULL,
  old_value TEXT, new_value TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_leave_emp ON leave_requests(employee_id, start_date);
CREATE INDEX idx_docs_emp ON employee_documents(employee_id, category);
CREATE INDEX idx_dec_emp ON decisions(employee_id, decision_date);

-- seed (ملف 002): قيم افتراضية قابلة للتعديل من الإعدادات
INSERT INTO leave_types (key,name_ar,yearly_entitlement,deducts_balance,counts_weekends,requires_attachment) VALUES
 ('annual','اعتيادي',21,1,0,0),
 ('casual','عارضة',7,1,0,0),
 ('sick','مرضي',NULL,0,0,1),
 ('unpaid','بدون مرتب',NULL,0,1,0);
INSERT INTO settings (key,value) VALUES
 ('code_prefix','EMP-'),
 ('weekend_days','5,6'),
 ('low_balance_threshold','3'),
 ('employee_files_root','');

-- === إضافات v2 (النواة والوحدات) ===
CREATE TABLE app_modules (
  key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE schema_migrations (
  module TEXT NOT NULL,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (module, name)
);
INSERT INTO app_modules (key,enabled) VALUES ('employees',1),('leaves',1),('documents',1),('decisions',1);
INSERT INTO settings (key,value) VALUES ('theme','system'),('sidebar_collapsed','0'),('language','ar');
-- ملحوظة: عند التنفيذ تُوزَّع الجداول على migrations كل وحدة حسب ARCHITECTURE_MODULES.md
-- (schema_migrations/app_modules/settings/audit_log/import_batches = core)
