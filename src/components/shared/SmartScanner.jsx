import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, Sparkles, FileUp, BrainCircuit } from 'lucide-react';
import { toast } from 'sonner';
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * SmartScanner Component
 * Handles Barcode detection and OCR with Gemini AI for precision text extraction.
 */
export default function SmartScanner({ 
  onResult, 
  label = "Digitalizar", 
  mode = "barcode_first", // barcode_first, ocr_only, gemini_only, any
  className = "" 
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Gemini AI Logic for Image Analysis (Direct Fetch for stability)
  const detectWithGemini = async (file) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
    const modelName = import.meta.env.VITE_GEMINI_MODEL?.trim() || "gemini-1.5-flash";

    if (!apiKey) return null;

    try {
      const readFileAsBase64 = (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      };

      const base64Data = await readFileAsBase64(file);
      const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;

      const prompt = `Analise esta imagem de uma etiqueta ou documento. 
      Tente extrair APENAS UM dos seguintes dados, por ordem de prioridade:
      1. Número de Série (S/N)
      2. Número de Imobilizado (Património)
      3. NIF / Número de Contribuinte (9 dígitos)
      
      Responda APENAS o código encontrado, sem mais nada. Se não encontrar nenhum, responda NOT_FOUND.`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: file.type || "image/jpeg", data: base64Data } }
            ]
          }]
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text || text === "NOT_FOUND") return null;
      
      return text.replace(/^(S\/N|SN|IMOBILIZADO|ID|Nº)[:\s]*/i, '').trim();
    } catch (e) {
      console.error('Gemini Fetch Error:', e);
      return null;
    }
  };

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

      const fullText = text.trim();
      const lines = text.split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length > 2);

      if (lines.length === 0) return null;

      // --- LÓGICA DE EXTRAÇÃO INTELIGENTE PARA S/N E IMOBILIZADO ---

      // 1. Procurar por padrões de "Nº DE IMOBILIZADO" ou "IMOBILIZADO" seguidos de número
      // Exemplo na foto: "Nº DE IMOBILIZADO: 1000804069"
      const imobMatch = fullText.match(/(?:IMOBILIZADO|Nº\s+DE\s+IMOBILIZADO)[:\s]+(\d{6,15})/i);
      if (imobMatch && imobMatch[1]) return imobMatch[1];

      // 2. Procurar por padrões de "S/N" ou "Serial" seguidos de alfanumérico
      // Exemplo na foto: "S/N YK1K14C0014333" ou "S/N 5CG2073QWM"
      const snMatch = fullText.match(/(?:S\/N|SERIAL|SERIAL\s+NUMBER)[:\s]+([A-Z0-9]{5,25})/i);
      if (snMatch && snMatch[1]) return snMatch[1];

      // 3. Procurar por números longos (provável imobilizado)
      const longNumber = lines.find(l => /^\d{8,12}$/.test(l.replace(/\s+/g, '')));
      if (longNumber) return longNumber.replace(/\s+/g, '');

      // 4. Procurar por candidatos a S/N (alfanumérico puro, 8-15 chars, comum em HP/Lenovo)
      const snCandidate = lines.find(l => /^[A-Z0-9]{8,12}$/i.test(l.replace(/\s+/g, '')));
      if (snCandidate) return snCandidate.replace(/\s+/g, '');

      // 5. Fallback: procurar por qualquer alfanumérico de 5+ caracteres que não tenha espaços
      const genericCandidate = lines.find(l => /^[A-Z0-9-]{5,20}$/i.test(l.replace(/\s+/g, '')));
      if (genericCandidate) return genericCandidate.replace(/\s+/g, '');

      // 6. Try to find email (manter como fallback)
      const emailCandidate = lines.find(l => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l));
      if (emailCandidate) return emailCandidate;

      // 7. Return the longest line
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
    // Tentar apenas Gemini AI (Alta precisão)
    if (import.meta.env.VITE_GEMINI_API_KEY) {
      return await detectWithGemini(file);
    }

    console.error("Gemini API Key não configurada. Impossível processar imagem.");
    toast.error("IA não configurada. Verifique as definições.");
    return null;
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
              {import.meta.env.VITE_GEMINI_API_KEY ? (
                <BrainCircuit className="w-4 h-4 text-primary" />
              ) : (
                <FileUp className="w-4 h-4" />
              )}
              <Sparkles className="absolute -top-1 -right-1 w-2 h-2 text-yellow-500 animate-pulse" />
            </div>
          )}
        </Button>
      </div>
    </div>
  );
}
