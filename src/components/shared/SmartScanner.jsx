import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, Sparkles, FileUp } from 'lucide-react';
import { toast } from 'sonner';

/**
 * SmartScanner Component
 * Handles Barcode detection and OCR with AI-like logic for text extraction.
 * Supports Camera, Gallery and File Upload (Image/PDF).
 */
export default function SmartScanner({ 
  onResult, 
  label = "Digitalizar", 
  mode = "barcode_first", // barcode_first, ocr_only, any
  className = "" 
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Native Barcode Detection
  const detectBarcode = async (source) => {
    if (!('BarcodeDetector' in window)) {
      console.warn('BarcodeDetector is not supported in this browser.');
      return null;
    }
    try {
      const detector = new window.BarcodeDetector({
        formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'code_39', 'codabar', 'itf', 'upc_a', 'upc_e'],
      });
      const bitmap = await createImageBitmap(source);
      const results = await detector.detect(bitmap);
      return results?.length > 0 ? results[0].rawValue.trim() : null;
    } catch (e) {
      console.error('Barcode detection error:', e);
      return null;
    }
  };

  // OCR Logic using Tesseract.js
  const detectText = async (source) => {
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('por'); // Portuguese
      
      const { data: { text } } = await worker.recognize(source);
      await worker.terminate();

      if (!text) return null;

      const lines = text.split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length > 2);

      if (lines.length === 0) return null;

      // 1. Try to find serial number (alphanumeric, 5+ chars)
      const serialCandidate = lines.find(l => /^[A-Z0-9-]{5,20}$/i.test(l.replace(/\s+/g, '')));
      if (serialCandidate) return serialCandidate.replace(/\s+/g, '');

      // 2. Try to find email
      const emailCandidate = lines.find(l => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l));
      if (emailCandidate) return emailCandidate;

      // 3. Return the longest line
      return lines.sort((a, b) => b.length - a.length)[0];
    } catch (e) {
      console.error('OCR error:', e);
      return null;
    }
  };

  const processFile = async (file) => {
    if (file.type === 'application/pdf') {
      return processPdf(file);
    }
    return processImage(file);
  };

  const processPdf = async (file) => {
     try {
       // PDF handling usually requires pdfjs-dist. For now, we'll try to get text or image
       toast.info('Processando PDF... extraindo primeira página.');
       const pdfjs = await import('pdfjs-dist');
       pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
       
       const arrayBuffer = await file.arrayBuffer();
       const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
       const page = await pdf.getPage(1);
      
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({ canvasContext: context, viewport }).promise;
      
      // Now process the canvas as an image
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
      return processImage(blob);
    } catch (e) {
      console.error('PDF Processing error:', e);
      throw new Error('Não foi possível processar o PDF.');
    }
  };

  const processImage = async (file) => {
    let result = null;
    if (mode !== 'ocr_only') {
      result = await detectBarcode(file);
    }
    if (!result) {
      result = await detectText(file);
    }
    return result;
  };

  const handleCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const loadingToast = toast.loading('A processar ficheiro...');

    try {
      const result = await processFile(file);

      if (result) {
        onResult(result);
        toast.success(`Capturado: ${result}`, { id: loadingToast });
      } else {
        toast.error('Não foi possível identificar dados no ficheiro.', { id: loadingToast });
      }
    } catch (error) {
      console.error('Scanner error:', error);
      toast.error(error.message || 'Erro ao processar o scanner.', { id: loadingToast });
    } finally {
      setIsProcessing(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      {/* Input para Ficheiros e Galeria */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleCapture}
      />
      
      {/* Input específico para Câmara (em dispositivos móveis) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapture}
      />

      <div className="flex bg-muted/50 rounded-lg p-0.5 border border-input shadow-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-white transition-all rounded-md"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isProcessing}
          title="Tirar Foto"
        >
          <Camera className="w-4 h-4" />
        </Button>
        
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-white transition-all rounded-md"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          title="Carregar Ficheiro ou Galeria"
        >
          {isProcessing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <div className="relative">
              <FileUp className="w-4 h-4" />
              <Sparkles className="absolute -top-1 -right-1 w-2 h-2 text-yellow-500 animate-pulse" />
            </div>
          )}
        </Button>
      </div>
    </div>
  );
}
