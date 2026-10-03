-- يثبّت توزيع أيام كل طلب على السنوات وقت إنشائه، حتى لا يتغير الرصيد المستهلك
-- بأثر رجعي إذا تغيّرت العطلة الأسبوعية أو أُضيفت عطلة رسمية لاحقًا.
CREATE TABLE leave_request_year_days (
  request_id INTEGER NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  days REAL NOT NULL,
  PRIMARY KEY (request_id, year)
);

CREATE INDEX idx_lryd_year ON leave_request_year_days(year);

-- تعبئة الطلبات القديمة التي تقع داخل سنة واحدة (الطلبات العابرة لسنتين لم تُنشأ قبل هذا التعديل).
INSERT INTO leave_request_year_days (request_id, year, days)
SELECT id, CAST(substr(start_date, 1, 4) AS INTEGER), days
FROM leave_requests
WHERE substr(start_date, 1, 4) = substr(end_date, 1, 4);
