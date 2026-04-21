import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Camera, FileText, Trash2, AlertTriangle } from 'lucide-react';

import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/api/db';

export default function FileUpload({ files = [], onChange, label = "Documentos / Fotos", isAdmin = false }) {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // index to delete
  const { user } = useAuth();

  const handleUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (!selectedFiles.length) return;
    setUploading(true);
    const newFiles = [];
    for (const file of selectedFiles) {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      newFiles.push({
        url: file_url,
        nome: file.name,
        tipo: file.type,
        data_upload: new Date().toISOString(),
        ativo: true
      });
    }
    onChange([...files, ...newFiles]);
    setUploading(false);
    toast.success(`${newFiles.length} ficheiro(s) carregado(s)`);
    e.target.value = '';
  };

  const softDelete = (index) => {
    const updated = files.map((f, i) => i === index ? {
      ...f,
      ativo: false,
      eliminado_por: user?.email || 'Utilizador',
      data_eliminacao: new Date().toISOString()
    } : f);
    onChange(updated);
    setConfirmDelete(null);
    toast.success('Ficheiro marcado como eliminado');
  };

  const isImage = (tipo) => tipo?.startsWith('image/');
  
  // Active files: show all, but mark deleted ones
  const activeFiles = files.filter(f => f.ativo !== false);
  const deletedFiles = files.filter(f => f.ativo === false);

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex gap-2">
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} accept="image/*,.pdf,.doc,.docx" />
        <input ref={cameraInputRef} type="file" capture="environment" accept="image/*" className="hidden" onChange={handleUpload} />
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? 'A carregar...' : 'Ficheiros'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()} disabled={uploading}>
          <Camera className="w-4 h-4 mr-2" />
          Câmara
        </Button>
      </div>

      {activeFiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
          {activeFiles.map((file, idx) => {
            const realIdx = files.indexOf(file);
            return (
              <div key={idx} className="relative group rounded-lg border bg-muted/50 overflow-hidden">
                {confirmDelete === realIdx ? (
                  <div className="absolute inset-0 bg-white/95 z-10 flex flex-col items-center justify-center p-2 gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <p className="text-xs text-center font-medium">Eliminar ficheiro?</p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="destructive" className="h-6 text-xs px-2" onClick={() => softDelete(realIdx)}>Sim</Button>
                      <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setConfirmDelete(null)}>Não</Button>
                    </div>
                  </div>
                ) : null}
                {isImage(file.tipo) ? (
                  <a href={file.url} target="_blank" rel="noopener noreferrer">
                    <img src={file.url} alt={file.nome} className="w-full h-24 object-cover" />
                  </a>
                ) : (
                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-24 p-2">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground mt-1 text-center truncate w-full">{file.nome}</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setConfirmDelete(realIdx)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin view of deleted files */}
      {isAdmin && deletedFiles.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold text-red-600 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Ficheiros eliminados (visível só para admin)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {deletedFiles.map((file, idx) => (
              <div key={idx} className="relative rounded-lg border-2 border-dashed border-red-400 bg-red-50 overflow-hidden opacity-70">
                <div className="absolute inset-0 bg-red-100/60 z-10 flex flex-col items-center justify-center p-1">
                  <Trash2 className="w-5 h-5 text-red-600" />
                  <span className="text-[9px] text-red-700 font-bold mt-1">ELIMINADO</span>
                  <span className="text-[8px] text-red-600 text-center">{file.eliminado_por}</span>
                </div>
                {isImage(file.tipo) ? (
                  <img src={file.url} alt={file.nome} className="w-full h-24 object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-24 p-2">
                    <FileText className="w-8 h-8 text-red-400" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
