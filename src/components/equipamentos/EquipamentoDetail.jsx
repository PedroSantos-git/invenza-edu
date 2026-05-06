import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pencil, Monitor, FileText, Eye } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import { format, isValid } from 'date-fns';
import DocumentViewer from '@/components/shared/DocumentViewer';
import { repairR2Url, isImageDoc } from '@/utils/r2Helpers';

const safeFormat = (dateStr, formatStr = 'dd/MM/yyyy') => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isValid(d) ? format(d, formatStr) : '—';
};

export default function EquipamentoDetail({ open, onClose, equipamento, onEdit, isAdmin = false }) {
  const [selectedDoc, setSelectedDoc] = useState(null);
  const { data: emprestimos = [] } = useQuery({
    queryKey: ['emprestimos-eq', equipamento?.id],
    queryFn: () => db.entities.Emprestimo.filter({ equipamento_id: equipamento.id }, '-created_at'),
    enabled: !!equipamento?.id
  });

  const { data: avarias = [] } = useQuery({
    queryKey: ['avarias-eq', equipamento?.id],
    queryFn: () => db.entities.Avaria.filter({ equipamento_id: equipamento.id }, '-created_at'),
    enabled: !!equipamento?.id
  });

  if (!equipamento) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <Monitor className="w-5 h-5" />
              {equipamento.designacao}
            </DialogTitle>
            <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="w-3 h-3 mr-2" />Editar</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Histórico completo e especificações técnicas</p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2 items-center">
            <StatusBadge status={equipamento.estado} />
            <span className="text-sm text-muted-foreground">{equipamento.tipo}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div><p className="text-xs text-muted-foreground">Nº Série</p><p className="text-sm font-medium font-mono">{equipamento.numero_serie}</p></div>
            <div><p className="text-xs text-muted-foreground">Imobilizado</p><p className="text-sm font-medium">{equipamento.numero_imobilizado || '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Marca / Modelo</p><p className="text-sm font-medium">{[equipamento.marca, equipamento.modelo].filter(Boolean).join(' ') || '—'}</p></div>
            {(equipamento.data_entrada || equipamento.data_aquisicao) && (
              <div><p className="text-xs text-muted-foreground">Data de Entrada</p><p className="text-sm font-medium">{safeFormat(equipamento.data_entrada || equipamento.data_aquisicao)}</p></div>
            )}
          </div>

          {equipamento.notas && <p className="text-sm text-muted-foreground">{equipamento.notas}</p>}

          <Tabs defaultValue="emprestimos">
            <TabsList>
              <TabsTrigger value="emprestimos">Empréstimos ({emprestimos.length})</TabsTrigger>
              <TabsTrigger value="avarias">Avarias ({avarias.length})</TabsTrigger>
              <TabsTrigger value="docs">Documentos</TabsTrigger>
            </TabsList>
            <TabsContent value="emprestimos" className="space-y-2 mt-3">
              {emprestimos.length === 0 ? <p className="text-sm text-muted-foreground">Sem empréstimos registados.</p> : (
                emprestimos.map(emp => (
                  <div key={emp.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{emp.pessoa_info}</p>
                      <p className="text-xs text-muted-foreground">{safeFormat(emp.data_emprestimo)}</p>
                    </div>
                    <StatusBadge status={emp.estado} />
                  </div>
                ))
              )}
            </TabsContent>
            <TabsContent value="avarias" className="space-y-2 mt-3">
              {avarias.length === 0 ? <p className="text-sm text-muted-foreground">Sem avarias registadas.</p> : (
                avarias.map(av => (
                  <div key={av.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{av.diagnostico || 'Sem diagnóstico'}</p>
                      <p className="text-xs text-muted-foreground">{av.origem} — {safeFormat(av.created_at)}</p>
                    </div>
                    <StatusBadge status={av.estado} />
                  </div>
                ))
              )}
            </TabsContent>
            <TabsContent value="docs" className="mt-3">
              {(!equipamento.documentos || equipamento.documentos.length === 0) ? (
                <p className="text-sm text-muted-foreground">Sem documentos.</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {equipamento.documentos.map((doc, i) => (
                    <div 
                      key={i} 
                      onClick={() => setSelectedDoc(doc)}
                      className="flex flex-col items-center p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer group relative"
                    >
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-white p-1 rounded-full shadow-sm">
                        <Eye className="w-3 h-3" />
                      </div>
                      {isImageDoc(doc) ? (
                        <img src={repairR2Url(doc.url)} className="w-full h-20 object-cover rounded shadow-sm" />
                      ) : (
                        <div className="w-full h-20 flex items-center justify-center bg-muted/30 rounded border border-dashed">
                          <FileText className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <span className="text-[10px] text-muted-foreground mt-2 truncate w-full text-center font-medium">{doc.nome}</span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>

      <DocumentViewer 
        open={!!selectedDoc} 
        onClose={() => setSelectedDoc(null)} 
        document={selectedDoc} 
      />
    </Dialog>
  );
}
