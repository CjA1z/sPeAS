import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Minus,
  Plus,
} from "lucide-react";
import {
  getDocument,
  GlobalWorkerOptions,
  TextLayer,
  type PDFDocumentProxy,
  type RenderTask,
} from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface HybridPaperViewerProps {
  paperId: string;
  title: string;
  authenticated: boolean;
  pageCount?: unknown;
}

export function HybridPaperViewer(props: HybridPaperViewerProps) {
  return props.authenticated
    ? <AuthenticatedPdfViewer paperId={props.paperId} title={props.title} />
    : (
      <GuestImageViewer
        paperId={props.paperId}
        title={props.title}
        pageCount={props.pageCount}
      />
    );
}

function GuestImageViewer({
  paperId,
  title,
  pageCount,
}: Omit<HybridPaperViewerProps, "authenticated">) {
  const suppliedPageCount = normalizePageCount(pageCount);
  const [pageNumber, setPageNumber] = useState(1);
  const [knownPageCount, setKnownPageCount] = useState(suppliedPageCount);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const imageUrl = `/api/papers/${encodeURIComponent(paperId)}/pages/${pageNumber}`;

  useEffect(() => {
    setPageNumber(1);
    setKnownPageCount(suppliedPageCount);
    setError("");
  }, [paperId, suppliedPageCount]);

  const changePage = (nextPage: number) => {
    if (nextPage < 1 || (knownPageCount && nextPage > knownPageCount)) return;
    setLoading(true);
    setError("");
    setPageNumber(nextPage);
  };

  const handleImageError = () => {
    setLoading(false);
    if (pageNumber > 1) {
      const lastPage = pageNumber - 1;
      setKnownPageCount(lastPage);
      setPageNumber(lastPage);
      setError("You have reached the last available preview page.");
      return;
    }
    setError("This paper preview is temporarily unavailable.");
  };

  return (
    <section className="peas-paper-viewer peas-paper-viewer--guest" aria-label="Document preview">

      <div className="peas-paper-viewer__stage" aria-busy={loading}>
        {loading ? <div className="peas-paper-viewer__loading" role="status">Rendering page…</div> : null}
        <img
          src={imageUrl}
          alt={`${title}, page ${pageNumber}`}
          onLoad={() => { setLoading(false); setError(""); }}
          onError={handleImageError}
        />
      </div>

      {error ? <p className="peas-paper-viewer__notice" role="status">{error}</p> : null}
      <nav className="peas-paper-viewer__controls" aria-label="Paper preview pages">
        <button
          type="button"
          onClick={() => changePage(pageNumber - 1)}
          disabled={pageNumber <= 1}
        >
          <ChevronLeft aria-hidden="true" /> Previous page
        </button>
        <span>Page {pageNumber}{knownPageCount ? ` / ${knownPageCount}` : ""}</span>
        <button
          type="button"
          onClick={() => changePage(pageNumber + 1)}
          disabled={Boolean(knownPageCount && pageNumber >= knownPageCount)}
        >
          Next page <ChevronRight aria-hidden="true" />
        </button>
      </nav>
    </section>
  );
}

function AuthenticatedPdfViewer({ paperId, title }: Pick<HybridPaperViewerProps, "paperId" | "title">) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const streamUrl = `/api/papers/${encodeURIComponent(paperId)}/stream`;
  const downloadUrl = `${streamUrl}?download=true`;

  useEffect(() => {
    let active = true;
    setPdf(null);
    setPageNumber(1);
    setLoading(true);
    setError("");

    const loadingTask = getDocument({ url: streamUrl, withCredentials: true });
    loadingTask.promise.then((document) => {
      if (!active) return;
      setPdf(document);
    }).catch(() => {
      if (active) setError("The interactive PDF could not be loaded.");
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      void loadingTask.destroy();
    };
  }, [streamUrl]);

  useEffect(() => {
    if (!pdf || !canvasRef.current || !textLayerRef.current) return;

    let active = true;
    let renderTask: RenderTask | null = null;
    let textLayer: TextLayer | null = null;
    setLoading(true);
    setError("");

    pdf.getPage(pageNumber).then(async (page) => {
      if (!active || !canvasRef.current || !textLayerRef.current) return;
      const viewport = page.getViewport({ scale });
      const outputScale = Math.max(1, window.devicePixelRatio || 1);
      const canvas = canvasRef.current;
      const textContainer = textLayerRef.current;

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      textContainer.replaceChildren();
      textContainer.style.width = `${Math.floor(viewport.width)}px`;
      textContainer.style.height = `${Math.floor(viewport.height)}px`;

      renderTask = page.render({
        canvas,
        viewport,
        transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
      });
      textLayer = new TextLayer({
        textContentSource: page.streamTextContent(),
        container: textContainer,
        viewport,
      });

      await Promise.all([renderTask.promise, textLayer.render()]);
    }).catch((caught) => {
      if (active && caught instanceof Error && caught.name !== "RenderingCancelledException") {
        setError("This PDF page could not be rendered.");
      }
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [pageNumber, pdf, scale]);

  const totalPages = pdf?.numPages ?? 0;
  const changePage = (nextPage: number) => {
    if (!pdf || nextPage < 1 || nextPage > pdf.numPages) return;
    setPageNumber(nextPage);
  };

  return (
    <section className="peas-paper-viewer peas-paper-viewer--pdf" aria-label="PDF viewer">
      <div className="peas-pdf-toolbar" role="toolbar" aria-label="PDF reader controls">
        <button type="button" aria-label="Previous page" disabled={pageNumber <= 1} onClick={() => changePage(pageNumber - 1)}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <label>
          <span className="peas-visually-hidden">Current page</span>
          <input
            type="number"
            min={1}
            max={totalPages || 1}
            value={pageNumber}
            onChange={(event) => changePage(Number(event.currentTarget.value))}
          />
          <span>of {totalPages || "…"}</span>
        </label>
        <button type="button" aria-label="Next page" disabled={!totalPages || pageNumber >= totalPages} onClick={() => changePage(pageNumber + 1)}>
          <ChevronRight aria-hidden="true" />
        </button>
        <span className="peas-pdf-toolbar__divider" aria-hidden="true" />
        <button type="button" aria-label="Zoom out" disabled={scale <= 0.7} onClick={() => setScale((value) => Math.max(0.7, value - 0.2))}>
          <Minus aria-hidden="true" />
        </button>
        <output aria-label="Zoom level">{Math.round(scale * 100)}%</output>
        <button type="button" aria-label="Zoom in" disabled={scale >= 2.1} onClick={() => setScale((value) => Math.min(2.1, value + 0.2))}>
          <Plus aria-hidden="true" />
        </button>
      </div>

      <div className="peas-paper-viewer__stage peas-paper-viewer__stage--pdf" aria-busy={loading}>
        {loading ? <div className="peas-paper-viewer__loading" role="status">Loading PDF page…</div> : null}
        {error ? (
          <div className="peas-paper-viewer__pdf-error" role="alert">
            <FileText aria-hidden="true" />
            <p>{error}</p>
          </div>
        ) : null}
        <div className="peas-pdf-page" aria-label={`${title}, page ${pageNumber}`}>
          <canvas ref={canvasRef} />
          <div ref={textLayerRef} className="textLayer" />
        </div>
      </div>
    </section>
  );
}

function normalizePageCount(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}
