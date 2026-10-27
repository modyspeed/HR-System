/**
 * Fixed ambient backdrop: drifting aurora glows + fine grain noise.
 * Sits behind everything (z-index -3/-2) and re-skins per theme.
 */
export function Aurora() {
  // The aurora itself is already rendered statically in index.html (outside
  // #root). A second copy here would be painted fully on top of the first, so
  // it only doubled the blur/animation cost with no visible difference.
  return <div className="noise" aria-hidden />
}
