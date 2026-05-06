import React, { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Trash2, Check, X, ChevronLeft, ChevronRight, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';

export default function DocumentScanner({ open, onClose, onComplete }) {
  const [photos, setPhotos] = useState([]);
  const [stream, setStream] = useState(null);
  const [isProcessing, setIsSearching] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', 
          width: { ideal: 1920 }, 
          height: { ideal: 1080 } 
        },
        audio: false
      });
      setStream(s);
    } catch (err) {
      console.error("Erro ao aceder à câmara:", err);
      toast.error("Não foi possível aceder à câmara. Verifique as permissões.");
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Efeito para ligar o stream ao elemento de vídeo quando ambos estão disponíveis
  React.useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      // Garantir que o vídeo começa a tocar
      videoRef.current.play().catch(e => console.error("Erro ao dar play no vídeo:", e));
    }
  }, [stream]);

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !stream) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Verificar se o vídeo tem dimensões válidas
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error("Aguarde que a câmara carregue a imagem.");
      return;
    }

    // Ajustar canvas para o tamanho do vídeo
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Desenhar frame do vídeo no canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Aplicar filtros básicos para parecer digitalizado (contraste/brilho)
    // No futuro podemos adicionar corte automático de margens
    
    const photoData = canvas.toDataURL('image/jpeg', 0.8);
    setPhotos([...photos, photoData]);
    toast.success(`Página ${photos.length + 1} capturada`);
  };

  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleFinish = async () => {
    if (photos.length === 0) return;

    try {
      setIsSearching(true);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < photos.length; i++) {
        if (i > 0) pdf.addPage();
        
        // Adicionar imagem ao PDF mantendo a proporção e ocupando a página toda
        pdf.addImage(photos[i], 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      }

      const pdfBlob = pdf.output('blob');
      const pdfFile = new File([pdfBlob], `digitalizacao_${new Date().getTime()}.pdf`, { type: 'application/pdf' });
      
      await onComplete(pdfFile);
      handleClose();
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao processar o documento PDF.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setPhotos([]);
    onClose();
  };

  React.useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Digitalizar Documento ({photos.length} págs)
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted
            className={`w-full h-full object-contain ${!stream ? 'hidden' : 'block'}`}
          />
          
          {!stream && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm">A iniciar câmara...</p>
            </div>
          )}
          
          {/* Overlay de ajuda para enquadramento */}
          {stream && <div className="absolute inset-8 border-2 border-white/20 border-dashed rounded-lg pointer-events-none" />}
          
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Miniaturas das fotos tiradas */}
        {photos.length > 0 && (
          <div className="h-24 border-t bg-muted/50 p-2 flex gap-2 overflow-x-auto">
            {photos.map((p, i) => (
              <div key={i} className="relative h-full aspect-[3/4] rounded border bg-white flex-shrink-0 group">
                <img src={p} alt={`pág ${i+1}`} className="w-full h-full object-cover rounded" />
                <button 
                  onClick={() => removePhoto(i)}
                  className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
                <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-[8px] text-white text-center py-0.5">{i+1}</span>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="p-4 border-t flex flex-row justify-between items-center gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={isProcessing}>
            Cancelar
          </Button>
          
          <div className="flex gap-2">
            <Button 
              size="lg" 
              className="rounded-full w-14 h-14 p-0 shadow-xl" 
              onClick={takePhoto}
              disabled={!stream || isProcessing}
            >
              <div className="w-10 h-10 rounded-full border-4 border-white" />
            </Button>
          </div>

          <Button 
            onClick={handleFinish} 
            disabled={photos.length === 0 || isProcessing}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
            Finalizar ({photos.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
