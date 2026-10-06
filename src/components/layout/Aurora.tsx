/**
 * Fixed ambient backdrop: drifting aurora glows + fine grain noise.
 * Sits behind everything (z-index -3/-2) and re-skins per theme.
 */
export function Aurora() {
  return (
    <>
      <div className="aurora" aria-hidden />
      <div className="noise" aria-hidden />
    </>
  )
}
