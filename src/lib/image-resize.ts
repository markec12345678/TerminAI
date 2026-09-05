'use client'

/**
 * Pomanjšanje fotografije V BRSKALNIKU pred nalaganjem.
 *
 * Zakaj? Foto iz telefona ima 3–12 MB — preveliko za lokalno SQLite bazo.
 * Canvas jo pomanjša na max 1200 px (~150–250 KB JPEG) + sličico 320 px
 * (~15–30 KB) za seznam. Vse ostane lokalno — brez oblaka, brez API ključev.
 */

function loadBitmap(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Slike ni bilo mogoče prebrati'))
    }
    img.src = url
  })
}

function drawScaled(img: HTMLImageElement, maxDim: number, quality: number): string {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas ni na voljo')
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

/** Velika slika za povečavo: max 1200 px, JPEG ~0.82. */
export async function shrinkFull(file: File): Promise<string> {
  return drawScaled(await loadBitmap(file), 1200, 0.82)
}

/** Sličica za seznam: max 320 px, JPEG ~0.72. */
export async function shrinkThumb(file: File): Promise<string> {
  return drawScaled(await loadBitmap(file), 320, 0.72)
}
