"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure the worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Props = {
  fileUrl: string;
  fileName: string;
};

export default function PdfViewer({ fileUrl, fileName }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);

  const [scale, setScale] = useState(1.0); // 1.0 = 100%

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3.0)); // max 300%
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5)); // min 50%
  const resetZoom = () => setScale(1.0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b bg-gray-100 px-2 py-1">
        {/* <span className="truncate text-sm font-medium">{fileName}</span> */}

        <div className="flex items-center gap-2 w-full justify-center">
          <button
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            className="rounded bg-gray-200 px-0.25 py-0.25 text-sm disabled:opacity-40"
          >
            ◀️ Prev
          </button>
          <span className="text-sm">
            {pageNumber} / {numPages || "?"}
          </span>
          <button
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
            className="rounded bg-gray-200 px-0.25 py-0.25 text-sm disabled:opacity-40"
          >
            Next ▶️
          </button>
          {/* Divider */}
          <div className="mx-1 h-5 w-px bg-gray-300" />

          {/* Zoom controls */}
          <button
            onClick={zoomOut}
            className="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300"
            title="Zoom out"
          >
            −
          </button>
          <button
            onClick={resetZoom}
            className="rounded bg-gray-200 px-3 py-1 text-sm min-w-[60px] hover:bg-gray-300"
            title="Reset zoom"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={zoomIn}
            className="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300"
            title="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {/* PDF Content */}
      <div
        className="flex justify-center overflow-auto p-4"
        style={{ height: "70vh" }}
      >
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={
            <div className="py-20 text-center text-gray-500">Loading PDF…</div>
          }
          error={
            <div className="py-20 text-center text-red-600">
              Failed to load PDF. Check if the bucket is public.
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            width={Math.min(800, typeof window !== "undefined" ? window.innerWidth - 100 : 800)}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  );
}