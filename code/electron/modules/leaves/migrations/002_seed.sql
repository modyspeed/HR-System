INSERT INTO leave_types (key, name_ar, yearly_entitlement, deducts_balance, counts_weekends, requires_attachment) VALUES
  ('annual', 'اعتيادي', 21, 1, 0, 0),
  ('casual', 'عارضة', 7, 1, 0, 0),
  ('sick', 'مرضي', NULL, 0, 0, 1),
  ('unpaid', 'بدون مرتب', NULL, 0, 1, 0);