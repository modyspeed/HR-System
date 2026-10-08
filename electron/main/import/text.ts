/**
 * Shared text/normalisation helpers for the Excel/PDF importers.
 * Header matching must tolerate Arabic orthography variants, RTL control
 * characters and Excel's bidi marks (`U+202B/U+200F/...`).
 */

/** Unify Arabic orthography + strip noise (RTL marks, newlines) so header matching is forgiving. */
export function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ـ/g, '')
    .replace(/[^\p{L}\p{N}% ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Digits → plain ASCII so numeric parsing is locale independent. */
export function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
}

/**
 * Excel exports wrap Arabic cells in bidi controls (RLE/PDF/RLM/ZWSP/BOM…)
 * — strip them so stored values are clean text.
 *
 * Built from code points so the source stays plain ASCII (the control
 * characters themselves are invisible and trip no-irregular-whitespace).
 */
const BIDI_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x061c, 0x061c], // ARABIC LETTER MARK
  [0x200b, 0x200f], // ZERO WIDTH SPACE .. RIGHT-TO-LEFT MARK
  [0x202a, 0x202e], // LRE .. RLO (Excel's bidi wrappers)
  [0x2060, 0x2064], // WORD JOINER .. FUNCTION APPLICATION
  [0x2066, 0x2069], // LRI .. PDI
  [0xfeff, 0xfeff] // ZERO WIDTH NO-BREAK SPACE (BOM)
]

const BIDI_RE = new RegExp(
  `[${BIDI_RANGES.map(([from, to]) => String.fromCharCode(from) + '-' + String.fromCharCode(to)).join('')}]`,
  'g'
)

export function stripBidi(value: string): string {
  return value.replace(BIDI_RE, '')
}

/** Identifiers (codes, insurance/national numbers): digits verbatim, separators stripped. */
export function toIdText(value: unknown): string {
  const text = stripBidi(normalizeDigits(String(value ?? '').trim()))
  if (!text) return ''
  // Keep identifiers verbatim (leading zeros matter); only strip thousands
  // separators and decimals so formatted cells like "26,805,110,202,578" match.
  if (/^\d[\d\s,]*$/.test(text) || /^\d[\d\s,]*\.\d*$/.test(text)) {
    const [integer] = text.replace(/[\s,]/g, '').split('.')
    return integer
  }
  return text
}

export function toNameText(value: unknown): string {
  return stripBidi(normalizeDigits(String(value ?? '')))
    .replace(/\s+/g, ' ')
    .trim()
}

/** Optional integer (qualification year, …) or null when empty/invalid. */
export function toIntOrNull(value: unknown): number | null {
  const text = normalizeDigits(String(value ?? '').trim()).replace(/[, ]/g, '')
  if (!text || !/^-?\d+$/.test(text)) return null
  const parsed = Number(text)
  return Number.isSafeInteger(parsed) ? parsed : null
}
