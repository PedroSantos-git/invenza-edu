import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Download, X, ZoomIn } from 'lucide-react';
import { repairR2Url, isImageDoc } from '@/utils/r2Helpers';

export default function DocumentViewer({ open, onClose, document }) {
  if (!document) return null;

  const isImage = isImageDoc(document);
  const isPdf = document.tipo === 'application/pdf' || 
                /\.pdf$/i.test(document.url);

  // Garantir que a URL está limpa e forçar o uso do domínio público se detectarmos o endpoint interno.
  const cleanUrl = repairR2Url(document.url);

  const handleDownload = () => {
    window.open(cleanUrl, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden bg-black/5 border-none shadow-2xl"
        aria-describedby={undefined}
      >
        <DialogHeader className="p-4 bg-white border-b flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-primary/10 rounded">
              {isImage ? <ZoomIn className="w-4 h-4 text-primary" /> : <FileText className="w-4 h-4 text-primary" />}
            </div>
            <div className="overflow-hidden">
              <DialogTitle className="text-sm font-semibold truncate">
                {document.nome || 'Visualizar Documento'}
              </DialogTitle>
              <p className="text-[10px] text-muted-foreground truncate">{cleanUrl}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload} className="h-8 gap-2">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-muted/20">
          {isImage ? (
            <div className="relative group max-w-full max-h-full">
              <img 
                src={cleanUrl} 
                alt={document.nome} 
                className="max-w-full max-h-full object-contain rounded shadow-lg transition-transform"
                crossOrigin="anonymous"
                onError={(e) => {
                  console.error("Erro ao carregar imagem no viewer:", cleanUrl);
                  e.target.onerror = null;
                  e.target.src = 'https://placehold.co/600x400?text=Erro+ao+carregar+imagem';
                }}
              />
            </div>
          ) : isPdf ? (
            <iframe 
              src={`${cleanUrl}#toolbar=0`} 
              className="w-full h-full border-none rounded shadow-lg bg-white"
              title={document.nome}
            />
          ) : (
            <div className="text-center p-12 bg-white rounded-xl shadow-sm border max-w-sm">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-bold text-lg mb-2">Ficheiro não visualizável</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Este tipo de ficheiro não pode ser visualizado diretamente no navegador.
              </p>
              <Button onClick={handleDownload} className="w-full gap-2">
                <Download className="w-4 h-4" />
                Descarregar Ficheiro
              </Button>
            </div>
          )}
        </div>
        
        <div className="p-3 bg-white border-t flex justify-center items-center gap-4">
          <p className="text-[10px] text-muted-foreground italic">
            Dica: Se o documento não carregar, verifique se a URL pública do R2 está configurada corretamente.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
