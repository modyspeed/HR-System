/**
 * Single source of truth for upload size limits.
 *
 * The main-process guards (`electron/main/*-files.ts`), the external scripts
 * (`scripts/link-employee-files.mjs`) and the UI copy all derive from here, so
 * raising the cap is a one-line change.
 */
const MB = 1024 * 1024

/**
 * Maximum size of a single attached document — an employee work file, a leave
 * document, a salary-grade entitlement or a transfer decision — and of an
 * imported monthly statement (payroll, incentive rates/penalties). Scanned
 * PDFs are often large, so the cap is deliberately generous.
 */
export const MAX_UPLOAD_SIZE = 200 * MB

/** The same cap in whole megabytes — for user-facing messages and hints. */
export const MAX_UPLOAD_SIZE_MB = MAX_UPLOAD_SIZE / MB
