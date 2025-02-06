'use client'

import { PDFDocument } from 'pdf-lib'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { FileText, Images, Type, Download, Merge } from 'lucide-react'
import * as PDFUtils from '../utils/pdf-utils'

export default function PDFEditor() {
  const [currentPDF, setCurrentPDF] = useState<ArrayBuffer | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [scale, setScale] = useState(1.5)
  const [tool, setTool] = useState<'text' | 'image' | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (currentPDF && canvasRef.current) {
      PDFUtils.renderPageToCanvas(
        currentPDF,
        currentPage,
        canvasRef.current,
        scale,
      )
      PDFUtils.getPageCount(currentPDF).then((count) => setTotalPages(count))
    }
  }, [currentPDF, currentPage, scale])

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    if (file) {
      const pdfBuffer = await PDFUtils.loadPDF(file)
      setCurrentPDF(pdfBuffer)
      setCurrentPage(1)
    }
  }

  const handleCanvasClick = async (
    event: React.MouseEvent<HTMLCanvasElement>,
  ) => {
    if (!currentPDF || !tool) return

    const pdfDoc = await PDFDocument.load(currentPDF)
    const pages = pdfDoc.getPages()

    const rect = canvasRef.current!.getBoundingClientRect()
    let x = event.pageX - rect.left
    let y = rect.height - event.pageY + 225

    const pdfHeight = pages[currentPage - 1].getHeight()
    const pdfWidth = pages[currentPage - 1].getWidth()

    y = (y * pdfHeight) / rect.height
    x = (x * pdfWidth) / rect.width

    if (tool === 'text') {
      const text = prompt('Enter text:')
      if (text) {
        const newPDF = await PDFUtils.addTextToPDF(
          currentPDF,
          text,
          { x, y },
          currentPage - 1,
        )
        setCurrentPDF(newPDF.buffer)
      }
    } else if (tool === 'image') {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) {
          const imageBuffer = await new Promise<ArrayBuffer>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as ArrayBuffer)
            reader.readAsArrayBuffer(file)
          })
          const newPDF = await PDFUtils.addImageToPDF(
            currentPDF,
            imageBuffer,
            { x, y },
            currentPage - 1,
            file.type.split('/')[1] as 'jpg' | 'png',
          )
          setCurrentPDF(newPDF.buffer)
        }
      }
      input.click()
    }
  }

  const handleMergePDFs = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || [])
    if (files.length > 0) {
      const pdfBuffers = await Promise.all(files.map(PDFUtils.loadPDF))
      console.log('Merging pdfs')
      const mergedPDF = await PDFUtils.mergePDFs(pdfBuffers)
      console.log('Merged pdfs')
      setCurrentPDF(mergedPDF.buffer)
      setCurrentPage(1)
    }
  }

  const handleDownload = async () => {
    if (!currentPDF) return
    const blob = new Blob([currentPDF], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'edited.pdf'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">PDF Editor</h1>
        <div className="flex gap-2">
          <Input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="w-[200px]"
          />
          <Button onClick={handleDownload} disabled={!currentPDF}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      <Tabs defaultValue="edit" className="w-full">
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="merge">Merge</TabsTrigger>
        </TabsList>
        <TabsContent value="edit" className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={tool === 'text' ? 'default' : 'outline'}
              onClick={() => setTool(tool === 'text' ? null : 'text')}
            >
              <Type className="w-4 h-4 mr-2" />
              Add Text
            </Button>
            <Button
              variant={tool === 'image' ? 'default' : 'outline'}
              onClick={() => setTool(tool === 'image' ? null : 'image')}
            >
              <Images className="w-4 h-4 mr-2" />
              Add Image
            </Button>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm">Zoom:</span>
              <Slider
                value={[scale]}
                min={0.5}
                max={2}
                step={0.1}
                onValueChange={([value]) => setScale(value)}
                className="w-[100px]"
              />
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-gray-50 min-h-[600px] flex items-center justify-center">
            {currentPDF ? (
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="max-w-full shadow-lg"
              />
            ) : (
              <div className="text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2" />
                <p>Upload a PDF to get started</p>
              </div>
            )}
          </div>

          {currentPDF && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="py-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="merge" className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Input
              type="file"
              accept=".pdf"
              multiple
              onChange={handleMergePDFs}
              className="hidden"
              id="merge-pdfs"
            />
            <label
              htmlFor="merge-pdfs"
              className="flex flex-col items-center cursor-pointer"
            >
              <Merge className="w-12 h-12 mb-2 text-gray-400" />
              <span className="text-sm text-gray-500">
                Select multiple PDFs to merge
              </span>
            </label>
          </div>

          <div className="border rounded-lg p-4 bg-gray-50 min-h-[600px] flex items-center justify-center">
            {currentPDF && (
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="max-w-full shadow-lg"
              />
            )}
          </div>

          {currentPDF && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="py-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
