import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import StatusBadge from '@/components/shared/StatusBadge';
import FileUpload from '@/components/shared/FileUpload';
import DocumentViewer from '@/components/shared/DocumentViewer';
import ComponentSelector, { COMP_LABELS } from '@/components/shared/ComponentSelector';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import EquipamentoDetail from '@/components/equipamentos/EquipamentoDetail';
import { toast } from 'sonner';
import { format, isValid } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { History, Eye, Loader2 } from 'lucide-react';
import { repairR2Url, isImageDoc } from '@/utils/r2Helpers';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';

const safeFormat = (dateStr, formatStr = 'dd/MM/yyyy') => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isValid(d) ? format(d, formatStr) : '—';
};

const ESTADOS_FLOW = ['A REVER', 'DIAGNOSTICADO', 'EM REPARAÇÃO', 'AGUARDA PEÇAS', 'ARRANJADO', 'INUTILIZADO'];
const PROTECTED_EMAIL = 'pedro.mf.santos@outlook.pt';

export default function AvariaDetail({ open, onClose, avaria }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.email === PROTECTED_EMAIL || user?.role === 'admin';

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [confirmClose, setConfirmClose] = useState(false);
  const [closeEstado, setCloseEstado] = useState('');
  const [showEquipDetail, setShowEquipDetail] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Buscar equipamento atual
  const { data: equipamentoAtual } = useQuery({
    queryKey: ['equipamento', avaria.equipamento_id],
    queryFn: () => db.entities.Equipamento.get(avaria.equipamento_id),
    enabled: !!avaria.equipamento_id && open
  });

  // Buscar equipamentos do conjunto
  const { data: kitData, isLoading: loadingKit } = useQuery({
    queryKey: ['equipamento-kit', avaria.equipamento_id],
    queryFn: async () => {
      const eq = await db.entities.Equipamento.get(avaria.equipamento_id);
      if (!eq?.numero_imobilizado) return { isKit: false };
      
      const allEqs = await db.entities.Equipamento.list();
      const siblings = allEqs.filter(e => e.numero_imobilizado === eq.numero_imobilizado && e.id !== eq.id);
      
      return {
        isKit: true,
        count: siblings.length + 1,
        main: eq,
        siblings: siblings.map(s => ({
          id: s.id,
          label: `${s.tipo} ${s.marca} ${s.modelo}`.trim(),
          sn: s.numero_serie,
          estado: s.estado
        }))
      };
    },
    enabled: !!avaria.equipamento_id && open
  });

  const startEdit = () => {
    setForm({
      estado: avaria.estado,
      diagnostico: avaria.diagnostico || '',
      resolucao: avaria.resolucao || '',
      componentes: avaria.componentes || {},
      documentos: avaria.documentos || [],
      equipamento_com_problemas: avaria.equipamento_com_problemas || false,
    });
    setEditing(true);
  };

  const buildLog = (data) => {
    const now = new Date().toISOString();
    const who = user?.email || 'Utilizador';
    const logs = [...(avaria.historico_estados || [])];

    if (data.estado !== avaria.estado) {
      logs.push({ tipo: 'estado', estado_anterior: avaria.estado, estado_novo: data.estado, data: now, utilizador: who });
    }
    if (data.diagnostico !== (avaria.diagnostico || '')) {
      logs.push({ tipo: 'campo', campo: 'diagnostico', valor_anterior: avaria.diagnostico || '', valor_novo: data.diagnostico, data: now, utilizador: who });
    }
    if (data.resolucao !== (avaria.resolucao || '')) {
      logs.push({ tipo: 'campo', campo: 'resolucao', valor_anterior: avaria.resolucao || '', valor_novo: data.resolucao, data: now, utilizador: who });
    }
    return logs;
  };

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const updates = { ...data };
      updates.historico_estados = buildLog(data);

      if (['ARRANJADO', 'INUTILIZADO'].includes(data.estado)) {
        updates.data_resolucao = new Date().toISOString().split('T')[0];
      }

      await db.entities.Avaria.update(avaria.id, updates);

      if (['ARRANJADO', 'INUTILIZADO'].includes(data.estado)) {
        const newEquipState = data.estado === 'ARRANJADO' ? 'Recondicionamento' : 'Inutilizado';
        await db.entities.Equipamento.update(avaria.equipamento_id, { estado: newEquipState });

        // Update related empréstimo if exists - find via devolucao_id
        if (avaria.devolucao_id) {
          const allDevs = await db.entities.Devolucao.list();
          const dev = allDevs.find(d => d.id === avaria.devolucao_id);
          if (dev && dev.emprestimo_id) {
            let newEmpEstado;
            if (data.estado === 'INUTILIZADO' || data.equipamento_com_problemas) {
              newEmpEstado = 'ENTREGUE COM DANOS';
            } else if (data.estado === 'ARRANJADO' && !data.equipamento_com_problemas) {
              newEmpEstado = 'DEVOLVIDO';
            }
            if (newEmpEstado) {
              await db.entities.Emprestimo.update(dev.emprestimo_id, { estado: newEmpEstado });
            }
          }
        }
      } else if (['AGUARDA PEÇAS', 'EM REPARAÇÃO'].includes(data.estado) && avaria.devolucao_id) {
        const allDevs = await db.entities.Devolucao.list();
        const dev = allDevs.find(d => d.id === avaria.devolucao_id);
        if (dev && dev.emprestimo_id) {
          await db.entities.Emprestimo.update(dev.emprestimo_id, { estado: 'ENTREGUE COM DANOS' });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries();
      setEditing(false);
      setConfirmClose(false);
      onClose();
      toast.success('Avaria atualizada');
    }
  });

  const handleSave = () => {
    if (['ARRANJADO', 'INUTILIZADO'].includes(form.estado) && form.estado !== avaria.estado) {
      setCloseEstado(form.estado);
      setConfirmClose(true);
    } else {
      updateMutation.mutate(form);
    }
  };

  const isClosed = ['ARRANJADO', 'INUTILIZADO'].includes(avaria.estado);

  const logEntries = (avaria.historico_estados || []).filter(h => h.tipo === 'estado' || !h.tipo);
  const fieldLogs = (avaria.historico_estados || []).filter(h => h.tipo === 'campo');

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex flex-col">
                <p className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">#{avaria.numero_avaria?.toString().padStart(4, '0') || '—'}</p>
                <DialogTitle>Avaria — {avaria.equipamento_info || 'Equipamento'}</DialogTitle>
              </div>
              <DialogDescription className="sr-only">Detalhes e histórico da avaria registada.</DialogDescription>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowEquipDetail(true)}>
                  <History className="w-4 h-4 mr-1" />Histório Equipamento
                </Button>
                {!isClosed && !editing && <Button variant="outline" size="sm" onClick={startEdit}>Editar</Button>}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex gap-2 items-center flex-wrap">
              <StatusBadge status={avaria.estado} />
              <span className="text-sm text-muted-foreground">{avaria.origem}</span>
              {avaria.equipamento_com_problemas && (
                <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-0.5">⚠ Equipamento com problemas</span>
              )}
              {avaria.data_resolucao && <span className="text-xs text-muted-foreground ml-auto">Resolvido: {safeFormat(avaria.data_resolucao)}</span>}
            </div>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <Label>Estado</Label>
                  <Select value={form.estado} onValueChange={v => setForm({ ...form, estado: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ESTADOS_FLOW.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border hover:bg-muted/50">
                  <Checkbox checked={form.equipamento_com_problemas} onCheckedChange={v => setForm({...form, equipamento_com_problemas: v})} />
                  <div>
                    <p className="text-sm font-medium">Equipamento com problemas</p>
                    <p className="text-xs text-muted-foreground">Atualiza o estado do empréstimo para "Entregue com danos"</p>
                  </div>
                </label>

                <div><Label>Diagnóstico</Label><Textarea value={form.diagnostico} onChange={e => setForm({...form, diagnostico: e.target.value})} /></div>
                <div><Label>Resolução</Label><Textarea value={form.resolucao} onChange={e => setForm({...form, resolucao: e.target.value})} /></div>

                <div>
                  <Label className="font-semibold">Componentes</Label>
                  <div className="mt-2">
                    <ComponentSelector componentes={form.componentes} onChange={c => setForm({...form, componentes: c})} />
                  </div>
                </div>

                <FileUpload files={form.documentos || []} onChange={docs => setForm({...form, documentos: docs})} isAdmin={isAdmin} />

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                  <Button onClick={handleSave} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? 'A guardar...' : 'Guardar'}
                  </Button>
                </div>
              </div>
            ) : (
              <Tabs defaultValue="geral">
                <TabsList className="w-full">
                  <TabsTrigger value="geral" className="flex-1">Diagnóstico</TabsTrigger>
                  {kitData?.isKit && kitData.count > 1 && (
                    <TabsTrigger value="kit" className="flex-1">Conjunto ({kitData.count})</TabsTrigger>
                  )}
                  <TabsTrigger value="historico" className="flex-1">Histórico</TabsTrigger>
                  <TabsTrigger value="docs" className="flex-1">Documentos</TabsTrigger>
                </TabsList>

                <TabsContent value="geral" className="space-y-4 pt-3">
                  <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                    <div><p className="text-xs text-muted-foreground">Diagnóstico</p><p className="text-sm">{avaria.diagnostico || '—'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Resolução</p><p className="text-sm">{avaria.resolucao || '—'}</p></div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold mb-2">Componentes</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {Object.entries(COMP_LABELS).map(([key, label]) => (
                        <div key={key} className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground w-20">{label}:</span>
                          <StatusBadge status={avaria.componentes?.[key] || 'DESCONHECIDO'} />
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="kit" className="pt-3 space-y-2">
                  {loadingKit ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                  ) : (
                    <>
                      <div className="p-3 rounded-lg border border-amber-100 bg-amber-50/20 text-xs flex justify-between items-center">
                        <div>
                          <p className="font-bold">{kitData.main?.tipo} {kitData.main?.marca} {kitData.main?.modelo}</p>
                          <p className="text-muted-foreground font-mono">S/N: {kitData.main?.numero_serie}</p>
                        </div>
                        <Badge className="bg-amber-600">AVARIA ATUAL</Badge>
                      </div>
                      {kitData.siblings?.map(sibling => (
                        <div key={sibling.id} className="p-3 rounded-lg border text-xs flex justify-between items-center">
                          <div>
                            <p className="font-medium">{sibling.label}</p>
                            <p className="text-muted-foreground font-mono">S/N: {sibling.sn}</p>
                          </div>
                          <StatusBadge status={sibling.estado} className="scale-75 origin-right" />
                        </div>
                      ))}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="historico" className="pt-3 space-y-5">
                  {/* State log */}
                  <div>
                    <p className="text-sm font-semibold mb-2">Estados</p>
                    {logEntries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sem histórico.</p>
                    ) : (
                      <div className="space-y-2">
                        {logEntries.map((h, i) => (
                          <div key={i} className="flex items-center gap-3 text-xs">
                            <span className="text-muted-foreground w-32">{safeFormat(h.data, 'dd/MM/yyyy HH:mm')}</span>
                            {h.estado_anterior && <><StatusBadge status={h.estado_anterior} /><span>→</span></>}
                            <StatusBadge status={h.estado_novo || h.estado} />
                            <span className="text-muted-foreground">{h.utilizador}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Field change log */}
                  {fieldLogs.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold mb-2">Alterações de Campos</p>
                      <div className="space-y-2">
                        {fieldLogs.map((h, i) => (
                          <div key={i} className="p-2 rounded border text-xs space-y-1">
                            <div className="flex items-center gap-2 justify-between">
                              <span className="font-semibold capitalize">{h.campo}</span>
                              <span className="text-muted-foreground">{safeFormat(h.data, 'dd/MM/yyyy HH:mm')} — {h.utilizador}</span>
                            </div>
                            {h.valor_anterior && <p className="text-muted-foreground line-through">{h.valor_anterior}</p>}
                            <p>{h.valor_novo}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="docs" className="pt-3 space-y-4">
                  {avaria.documentos?.filter(d => d.ativo !== false).length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {avaria.documentos.filter(d => d.ativo !== false).map((doc, i) => (
                        <div 
                          key={i} 
                          onClick={() => setSelectedDoc(doc)}
                          className="p-2 rounded border hover:bg-muted/50 text-center cursor-pointer group relative"
                        >
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-white p-1 rounded-full shadow-sm">
                            <Eye className="w-3 h-3" />
                          </div>
                          {isImageDoc(doc) ? (
                            <img src={repairR2Url(doc.url)} className="w-full h-16 object-cover rounded" />
                          ) : (
                            <span className="text-xs">{doc.nome}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Sem documentos ativos.</p>
                  )}

                  {/* Admin: show deleted docs */}
                  {isAdmin && avaria.documentos?.filter(d => d.ativo === false).length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-semibold text-red-600 mb-1">Documentos eliminados (admin)</p>
                      <div className="grid grid-cols-3 gap-2">
                        {avaria.documentos.filter(d => d.ativo === false).map((doc, i) => (
                          <div key={i} className="p-2 rounded border-2 border-dashed border-red-400 bg-red-50 text-center opacity-70">
                            <span className="text-xs text-red-600">🗑 {doc.nome}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DocumentViewer 
        open={!!selectedDoc} 
        onClose={() => setSelectedDoc(null)} 
        document={selectedDoc} 
      />

      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => updateMutation.mutate(form)}
        title={closeEstado === 'INUTILIZADO' ? 'Marcar como Inutilizado?' : 'Marcar como Arranjado?'}
        description={closeEstado === 'INUTILIZADO' ? 'O equipamento será marcado como Inutilizado.' : 'O equipamento passará para o estado Recondicionamento.'}
        confirmLabel="Confirmar"
        destructive={closeEstado === 'INUTILIZADO'}
      />

      {/* Equipment history dialog */}
      {showEquipDetail && equipamentoAtual && (
        <EquipamentoDetail
          open={showEquipDetail}
          onClose={() => setShowEquipDetail(false)}
          equipamento={equipamentoAtual}
          onEdit={() => setShowEquipDetail(false)}
          isAdmin={isAdmin}
        />
      )}
    </>
  );
}
