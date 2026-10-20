"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase"; // adjust path if needed

const PdfViewer = dynamic(() => import("../helper/PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[70vh] items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400">
      Loading viewer…
    </div>
  ),
});

type StorageItem = {
  name: string;
  id: string | null;
  created_at?: string;
  metadata?: { size?: number } | null;
  // folders have id === null
};

const BUCKET_NAME = "retail"; // ← your bucket name

export default function PriceListPage() {
  const [currentPath, setCurrentPath] = useState("Scheme"); // "" = root
  const [items, setItems] = useState<StorageItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load files & folders for the current path
  useEffect(() => {
    async function loadItems() {
      setLoading(true);
      setError(null);
      setSelectedFile(null);
      setPdfUrl(null);

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(currentPath, {
          limit: 100,
          sortBy: { column: "name", order: "asc" },
        });

      if (error) {
        console.error(error);
        setError(error.message);
        setLoading(false);
        return;
      }

      setItems((data as StorageItem[]) || []);
      setLoading(false);
    }

    loadItems();
  }, [currentPath]);

  // Open a PDF
  const openPdf = (fileName: string) => {
    const fullPath = currentPath ? `${currentPath}/${fileName}` : fileName;
    setSelectedFile(fullPath);

    const { data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fullPath);

    setPdfUrl(data.publicUrl);
  };

  // Enter a folder
  const enterFolder = (folderName: string) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    setCurrentPath(newPath);
  };

  // Go up one level
  const goUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split("/");
    parts.pop();  if(parts.length===0){parts.push("Scheme");}
    setCurrentPath(parts.join("/"));
  };

  const formatSize = (bytes?: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Separate folders and PDF files
  const folders = items.filter((item) => item.id === null);
  const pdfs = items.filter(
    (item) => item.id !== null && item.name.toLowerCase().endsWith(".pdf")
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 py-1 px-1.5 sm:px-2 lg:px-3">
      <div className="mx-auto max-w-7xl">
        {/* <h1 className="mb-1 text-xl font-semibold text-gray-900">Price Lists</h1> */}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* LEFT SIDE: Browser */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm text-sm md:text-base">
            {/* Header + Back button */}
            <div className="flex items-center justify-between border-b bg-gray-100 px-2 py-0.25">
              <span className="font-semibold truncate">
                {currentPath || "Top Level"}
              </span>
              {currentPath && (
                <button
                  onClick={goUp}
                  className="rounded bg-gray-200 px-2 py-1 text-xs hover:bg-gray-300"
                >
                ◀️ Back
                </button>
              )}
            </div>

            {loading && (
              <div className="p-1 text-center text-gray-500">Loading…</div>
            )}
            {error && (
              <div className="p-1 text-center text-red-600 text-sm">{error}</div>
            )}

            {!loading && folders.length === 0 && pdfs.length === 0 && (
              <div className="p-1 text-center text-gray-500">Empty folder</div>
            )}

            <ul className="divide-y">
              {/* Folders first */}
              {folders.map((folder) => (
                <li key={folder.name}>
                  <button
                    onClick={() => enterFolder(folder.name)}
                    className="flex w-full items-center gap-2 px-1 py-1 text-left hover:bg-blue-50"
                  >
                    <span className="text-md">📁</span>
                    <span className="truncate font-medium">{folder.name}</span>
                  </button>
                </li>
              ))}

              {/* PDF files */}
              {pdfs.map((file) => (
                <li key={file.id || file.name}>
                  <button
                    onClick={() => openPdf(file.name)}
                    className={`flex w-full items-center gap-2 px-1 py-1 text-left transition-colors hover:bg-blue-50 ${
                      selectedFile?.endsWith(file.name)
                        ? "bg-blue-100 font-medium text-blue-800"
                        : ""
                    }`}
                  >
                    <span className="text-md">📄</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center">
                          <span className="truncate flex-1">
                            {file.name}
                          </span>

                          <span className="ml-auto text-xs text-gray-500 px-2 shrink-0">
                            {formatSize(file.metadata?.size)}
                          </span>
                        </div>
                      </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* RIGHT SIDE: Viewer */}
          <div className="lg:col-span-2">
            {!pdfUrl || !selectedFile ? (
              <div className="flex h-[70vh] items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white text-gray-400">
                Select a PDF to view
              </div>
            ) : (
              <PdfViewer fileUrl={pdfUrl} fileName={selectedFile} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}