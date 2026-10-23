/** تطبيع نص بنود الظرف — منفصل عن محلّل PDF ليعاد استخدامه بلا تبعيات ثقيلة. */
export function normalizeItemText(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // حركات + تطويل
    .replace(/[\u0660-\u0669]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\u066B\u066C]/g, '.')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/[ىئ]/g, 'ي')
    // الأقواس تخرج معكوسة من الـPDF في السياق العربي — نعيد ترتيبها.
    .replace(/\)([^()]*)\(/g, '($1)')
    .replace(/[^\S\n]+/g, ' ')
    .trim()
}

/** مفتاح التجميع: نفس البند بأشكال إملائية مختلفة ⇒ عمود واحد. */
export function itemLabelKey(label: string): string {
  return normalizeItemText(label)
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, '')
    .replace(/^ال(?=.{3,})/, '')
}
