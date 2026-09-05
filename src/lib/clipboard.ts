/**
 * Kopiranje v odložišče — deluje tudi na http:// (LAN, USB namestitev),
 * kjer Clipboard API ni na voljo (zahteva varen kontekst).
 * Timeout ščiti pred obesitvijo API-ja (nekateri brskalniki/permissions).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      const ok = await Promise.race([
        navigator.clipboard.writeText(text).then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1500)),
      ])
      if (ok) return true
    }
  } catch {
    /* poskusimo z zastarelim pristopom */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
