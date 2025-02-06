import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { getDocument } from 'pdfjs-dist'
import 'pdfjs-dist/build/pdf.worker.min.mjs'

export async function loadPDF(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export async function mergePDFs(pdfs: ArrayBuffer[]): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create()

  for (const pdfBytes of pdfs) {
    // Create a new copy of the ArrayBuffer
    const pdfBytesCopy = pdfBytes.slice(0)
    const pdf = await PDFDocument.load(pdfBytesCopy)
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
    copiedPages.forEach((page) => mergedPdf.addPage(page))
  }

  return mergedPdf.save()
}

export async function splitPDF(
  pdfBytes: ArrayBuffer,
  pageRanges: [number, number][],
): Promise<Uint8Array[]> {
  const pdf = await PDFDocument.load(pdfBytes)
  const results: Uint8Array[] = []

  for (const [start, end] of pageRanges) {
    const newPdf = await PDFDocument.create()
    const pages = await newPdf.copyPages(
      pdf,
      Array.from({ length: end - start + 1 }, (_, i) => start + i),
    )
    pages.forEach((page) => newPdf.addPage(page))
    results.push(await newPdf.save())
  }

  return results
}

export async function addTextToPDF(
  pdfBytes: ArrayBuffer,
  text: string,
  position: { x: number; y: number },
  pageIndex: number,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pages = pdfDoc.getPages()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  pages[pageIndex].drawText(text, {
    x: position.x,
    y: position.y,
    font,
    size: 12,
    color: rgb(0, 0, 0),
  })

  return pdfDoc.save()
}

export async function addImageToPDF(
  pdfBytes: ArrayBuffer,
  imageBytes: ArrayBuffer,
  position: { x: number; y: number },
  pageIndex: number,
  type: 'jpg' | 'jpeg' | 'png' = 'png',
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const img =
    type === 'jpg' || type === 'jpeg'
      ? await pdfDoc.embedJpg(imageBytes)
      : await pdfDoc.embedPng(imageBytes)
  const pages = pdfDoc.getPages()

  pages[pageIndex].drawImage(img, {
    x: position.x,
    y: position.y,
    width: 100,
    height: 100,
  })

  return pdfDoc.save()
}

export async function getPageCount(pdfBytes: ArrayBuffer): Promise<number> {
  try {
    // Create a new copy of the ArrayBuffer
    const pdfBytesCopy = pdfBytes.slice(0)
    const pdf = await getDocument({ data: new Uint8Array(pdfBytesCopy) })
      .promise
    const pageCount = pdf.numPages
    await pdf.destroy()
    return pageCount
  } catch (error) {
    console.error('Error getting page count:', error)
    throw new Error('Failed to get PDF page count')
  }
}

export async function renderPageToCanvas(
  pdfBytes: ArrayBuffer,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale = 1.5,
): Promise<void> {
  const pdfBytesCopy = pdfBytes.slice(0)
  const pdf = await getDocument({ data: pdfBytesCopy }).promise
  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale })

  canvas.width = viewport.width
  canvas.height = viewport.height

  await page.render({
    canvasContext: canvas.getContext('2d')!,
    viewport,
  }).promise
}
