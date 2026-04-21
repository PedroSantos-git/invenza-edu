import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FileUpload from '@/components/shared/FileUpload';
import SmartScanner from '@/components/shared/SmartScanner';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

const DEFAULT_COMPONENTES = {
  ecra: 'DESCONHECIDO', disco: 'DESCONHECIDO', ram: 'DESCONHECIDO',
  board: 'DESCONHECIDO', bateria: 'DESCONHECIDO', teclado: 'DESCONHECIDO', touchpad: 'DESCONHECIDO'
};

function MiniEquipamentoForm({ onCreated, onCancel }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ designacao: '', numero_serie: '', numero_imobilizado: '', marca: '', modelo: '', tipo: 'Portátil', estado: 'DISPONÍVEL', documentos: [] });
  const { data: tipos = [] } = useQuery({ queryKey: ['tipos-equipamento'], queryFn: () => db.entities.TipoEquipamento.list() });
  const tiposAtivos = tipos.filter(t => t.ativo !== false);
  const mut = useMutation({
    mutationFn: () => db.entities.Equipamento.create(form),
    onSuccess: (eq) => { qc.invalidateQueries({ queryKey: ['equipamentos'] }); onCreated(eq); toast.success('Equipamento criado'); }
  });
  return (
    <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
      <p className="text-sm font-semibold">Criar novo equipamento</p>
      <div><Label>Designação *</Label><Input value={form.designacao} onChange={e => setForm({...form, designacao: e.target.value})} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Nº Série *</Label><Input value={form.numero_serie} onChange={e => setForm({...form, numero_serie: e.target.value})} /></div>
        <div><Label>Nº Imobilizado</Label><Input value={form.numero_imobilizado} onChange={e => setForm({...form, numero_imobilizado: e.target.value})} /></div>
        <div><Label>Marca</Label><Input value={form.marca} onChange={e => setForm({...form, marca: e.target.value})} /></div>
        <div><Label>Modelo</Label><Input value={form.modelo} onChange={e => setForm({...form, modelo: e.target.value})} /></div>
        <div className="col-span-2">
          <Label>Tipo</Label>
          {tiposAtivos.length > 0 ? (
            <Select value={form.tipo} onValueChange={v => setForm({...form, tipo: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{tiposAtivos.map(t => <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>)}</SelectContent>
            </Select>
          ) : <Input value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} />}
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={() => mut.mutate()} disabled={!form.designacao || !form.numero_serie || mut.isPending}>Criar</Button>
      </div>
    </div>
  );
}

export default function AvariaForm({ open, onClose }) {
  const qc = useQueryClient();
  const [eqSearch, setEqSearch] = useState('');
  const [selectedEq, setSelectedEq] = useState(null);
  const [diagnostico, setDiagnostico] = useState('');
  const [docs, setDocs] = useState([]);
  const [createEq, setCreateEq] = useState(false);

  const { data: equipamentos = [] } = useQuery({
    queryKey: ['equipamentos'], queryFn: () => db.entities.Equipamento.list()
  });

  // Allow all states except EMPRESTADO
  const availableEq = equipamentos.filter(e =>
    e.estado !== 'EMPRESTADO' &&
    (eqSearch === '' || [e.numero_serie, e.numero_imobilizado, e.designacao, e.marca, e.modelo].some(f => f?.toLowerCase().includes(eqSearch.toLowerCase())))
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      await db.entities.Avaria.create({
        equipamento_id: selectedEq.id,
        equipamento_info: `${selectedEq.designacao} (${selectedEq.numero_serie})`,
        origem: 'DIRETA',
        estado: 'A REVER',
        diagnostico,
        componentes: DEFAULT_COMPONENTES,
        historico_estados: [{
          tipo: 'estado',
          estado_novo: 'A REVER',
          data: new Date().toISOString(),
          utilizador: 'Sistema'
        }],
        documentos: docs
      });
      await db.entities.Equipamento.update(selectedEq.id, { estado: 'EM AVARIA' });
    },
    onSuccess: () => {
      qc.invalidateQueries();
      handleClose();
      toast.success('Avaria registada com sucesso');
    }
  });

  const handleClose = () => {
    setSelectedEq(null); setEqSearch(''); setDiagnostico(''); setDocs([]); setCreateEq(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova Avaria (Direta)</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold text-muted-foreground">Nº Avaria</Label>
              <div className="p-2 border rounded bg-muted/50 text-sm font-mono">(automático)</div>
            </div>
          </div>
          <div className="space-y-2">
              <Label className="font-semibold">Equipamento</Label>
              {selectedEq ? (
                <div className="p-3 rounded-lg border bg-amber-50 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">{selectedEq.designacao}</p>
                    <p className="text-xs text-muted-foreground">SN: {selectedEq.numero_serie} — {selectedEq.estado}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedEq(null)}>Alterar</Button>
                </div>
              ) : createEq ? (
                <MiniEquipamentoForm onCreated={eq => { setSelectedEq(eq); setCreateEq(false); }} onCancel={() => setCreateEq(false)} />
              ) : (
                <>
                  <div className="flex gap-2">
                    <Input placeholder="Nome, nº série, imobilizado..." value={eqSearch} onChange={e => setEqSearch(e.target.value)} className="flex-1" />
                    <SmartScanner onResult={v => setEqSearch(v)} label="Ler Equipamento" />
                  </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {availableEq.slice(0, 10).map(eq => (
                    <button key={eq.id} onClick={() => setSelectedEq(eq)} className="w-full text-left p-2 rounded hover:bg-muted text-sm flex justify-between">
                      <span>{eq.designacao} — {eq.numero_serie}</span>
                      <span className="text-xs text-muted-foreground">{eq.estado}</span>
                    </button>
                  ))}
                  {eqSearch && availableEq.length === 0 && (
                    <div className="p-2">
                      <p className="text-sm text-muted-foreground mb-2">Nenhum equipamento encontrado.</p>
                      <Button size="sm" variant="outline" onClick={() => setCreateEq(true)}><Plus className="w-4 h-4 mr-1" />Criar equipamento</Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div>
            <Label>Diagnóstico Inicial</Label>
            <div className="flex gap-2 items-start">
              <Textarea value={diagnostico} onChange={e => setDiagnostico(e.target.value)} placeholder="Descrição do problema..." className="flex-1" />
              <SmartScanner onResult={v => setDiagnostico((diagnostico ? diagnostico + '\n' : '') + v)} label="Ler Diagnóstico" mode="ocr_only" />
            </div>
          </div>
          <FileUpload files={docs} onChange={setDocs} label="Fotos/Documentos" />

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!selectedEq || createMutation.isPending}>
              {createMutation.isPending ? 'A registar...' : 'Registar Avaria'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
