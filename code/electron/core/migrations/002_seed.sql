INSERT OR IGNORE INTO settings (key, value) VALUES
  ('code_prefix', 'EMP-'),
  ('weekend_days', '5,6'),
  ('low_balance_threshold', '3'),
  ('employee_files_root', ''),
  ('theme', 'system'),
  ('sidebar_collapsed', '0'),
  ('language', 'ar');

INSERT OR IGNORE INTO app_modules (key, enabled) VALUES
  ('employees', 1),
  ('leaves', 1),
  ('documents', 1),
  ('decisions', 1);