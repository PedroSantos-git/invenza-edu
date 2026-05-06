import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Download, X, ZoomIn, Loader2 } from 'lucide-react';
import { repairR2Url, isImageDoc } from '@/utils/r2Helpers';
import mammoth from 'mammoth';

export default function DocumentViewer({ open, onClose, document }) {
  const [wordHtml, setWordHtml] = useState(null);
  const [loadingWord, setLoadingWord] = useState(false);

  useEffect(() => {
    if (open && isWord && document?.url) {
      loadWordDoc();
    } else {
      setWordHtml(null);
    }
  }, [open, document]);

  if (!document) return null;

  const isImage = isImageDoc(document);
  const isPdf = document.tipo === 'application/pdf' || 
                /\.pdf$/i.test(document.url);
  const isWord = document.tipo === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                 /\.docx$/i.test(document.url);

  // Garantir que a URL está limpa e forçar o uso do domínio público se detectarmos o endpoint interno.
  const cleanUrl = repairR2Url(document.url);

  const loadWordDoc = async () => {
    try {
      setLoadingWord(true);
      const response = await fetch(cleanUrl);
      const arrayBuffer = await response.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setWordHtml(result.value);
    } catch (err) {
      console.error("Erro ao converter Word:", err);
      setWordHtml('<p class="text-red-500">Erro ao carregar documento Word. Por favor, faça download para visualizar.</p>');
    } finally {
      setLoadingWord(false);
    }
  };

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
                  // Tentar limpar a URL se falhar (pode ser problema de query params de auth do S3)
                  const urlOnly = cleanUrl.split('?')[0];
                  if (e.target.src !== urlOnly) {
                    e.target.src = urlOnly;
                  } else {
                    e.target.src = 'https://placehold.co/600x400?text=Erro+ao+carregar+imagem';
                  }
                }}
              />
            </div>
          ) : isPdf ? (
            <iframe 
              src={`${cleanUrl.split('?')[0]}#toolbar=0`} 
              className="w-full h-full border-none rounded shadow-lg bg-white"
              title={document.nome}
            />
          ) : isWord ? (
            <div className="w-full h-full bg-white rounded shadow-lg p-8 overflow-auto prose prose-sm max-w-none">
              {loadingWord ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">A converter documento Word...</p>
                </div>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: wordHtml }} />
              )}
            </div>
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
          <p className="text-[10px] text-muted-foreground italic text-center">
            Nota: A visualização de documentos Word é experimental. Se notar erros de formatação, faça download do ficheiro original.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

