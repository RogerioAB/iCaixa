/** Reduz a foto do celular (12 MP) para no máximo 2000 px e devolve o JPEG em base64. */
export async function prepararFoto(arquivo: File, ladoMax = 2000): Promise<{ base64: string; previa: string }> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const previa = canvas.toDataURL('image/jpeg', 0.85)
  return { base64: previa.slice(previa.indexOf(',') + 1), previa }
}
