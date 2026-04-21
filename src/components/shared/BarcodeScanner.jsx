import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, ScanLine } from 'lucide-react';
import { toast } from 'sonner';

export default function BarcodeScanner({ onResult, label = "Câmara/Scanner" }) {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const inputRef = React.useRef(null);

  const detectBarcode = async (file) => {
    if (!('BarcodeDetector' in window)) return null;
    const detector = new window.BarcodeDetector({
      formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'code_39', 'codabar', 'itf', 'upc_a', 'upc_e'],
    });
    const bitmap = await createImageBitmap(file);
    const results = await detector.detect(bitmap);
    if (!results?.length) return null;
    return results[0]?.rawValue?.trim() || null;
  };

  const detectText = async (file) => {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('por');
    const {
      data: { text },
    } = await worker.recognize(file);
    await worker.terminate();

    const cleaned = String(text || '')
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    const candidates = cleaned
      .map(l => l.replace(/\s+/g, ''))
      .filter(l => /[A-Z0-9]/i.test(l))
      .sort((a, b) => b.length - a.length);

    const best = candidates.find(c => c.length >= 4) || null;
    return best;
  };

  const handleCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    try {
      const barcode = await detectBarcode(file);
      const value = barcode || (await detectText(file));
      if (value) {
        onResult(value);
        setOpen(false);
        toast.success(`Código lido: ${value}`);
      } else {
        toast.error('Não foi possível ler o código. Tente novamente.');
      }
    } catch (err) {
      toast.error('Erro ao processar imagem');
    }
    setScanning(false);
    e.target.value = '';
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} title={label}>
        <ScanLine className="w-4 h-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Scanner / OCR</DialogTitle></DialogHeader>
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">Tire uma foto ou carregue uma imagem com código de barras, QR code, ou texto com número de série.</p>
            <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCapture} />
            <Button onClick={() => inputRef.current?.click()} disabled={scanning} className="w-full">
              <Camera className="w-4 h-4 mr-2" />
              {scanning ? 'A processar...' : 'Abrir Câmara / Selecionar Imagem'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
