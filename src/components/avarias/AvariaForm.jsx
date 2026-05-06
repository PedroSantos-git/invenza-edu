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
import ComponentSelector from '@/components/shared/ComponentSelector';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

const DEFAULT_COMPONENTES = {
  ecra: 'DESCONHECIDO', disco: 'DESCONHECIDO', ram: 'DESCONHECIDO',
  board: 'DESCONHECIDO', bateria: 'DESCONHECIDO', ventoinha: 'DESCONHECIDO',
  teclado: 'DESCONHECIDO', touchpad: 'DESCONHECIDO'
};

const ESTADOS_AVARIA = ['A REVER', 'DIAGNOSTICADO', 'EM REPARAÇÃO', 'AGUARDA PEÇAS', 'ARRANJADO', 'INUTILIZADO'];

function MiniEquipamentoForm({ onCreated, onCancel }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ designacao: '', numero_serie: '', numero_imobilizado: '', marca: '', modelo: '', tipo: 'Portátil', estado: 'Rececionado', documentos: [] });
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
  const [estado, setEstado] = useState('A REVER');
  const [componentes, setComponentes] = useState(DEFAULT_COMPONENTES);
  const [docs, setDocs] = useState([]);
  const [createEq, setCreateEq] = useState(false);

  const { data: equipamentos = [] } = useQuery({
    queryKey: ['equipamentos', 'avarias'], 
    queryFn: () => db.entities.Equipamento.filter({ estado: ['Rececionado', 'Recondicionamento', 'Manutenção', 'Recuperável'] })
  });

  const availableEq = equipamentos.filter(e =>
    eqSearch === '' || [e.numero_serie, e.designacao, e.marca, e.modelo].some(f => f?.toLowerCase().includes(eqSearch.toLowerCase()))
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const eqNome = `${selectedEq.tipo} ${selectedEq.marca} ${selectedEq.modelo}`.trim() || selectedEq.designacao;
      
      // Obter o próximo número de avaria (max + 1)
      const { data: maxAvaria } = await db.client
        .from('avarias')
        .select('numero_avaria')
        .order('numero_avaria', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextNumero = maxAvaria?.numero_avaria ? maxAvaria.numero_avaria + 1 : 1001;

      const avariaPayload = {
        numero_avaria: nextNumero,
        equipamento_id: selectedEq.id,
        equipamento_info: eqNome,
        origem: 'DIRETA',
        estado: estado,
        diagnostico,
        componentes: componentes,
        historico_estados: [{
          tipo: 'estado',
          estado_novo: estado,
          data: new Date().toISOString(),
          utilizador: 'Sistema'
        }],
        documentos: docs
      };

      if (['ARRANJADO', 'INUTILIZADO'].includes(estado)) {
        avariaPayload.data_resolucao = new Date().toISOString().split('T')[0];
      }

      await db.entities.Avaria.create(avariaPayload);
      
      const newEquipState = estado === 'ARRANJADO' ? 'Recondicionamento' : (estado === 'INUTILIZADO' ? 'Inutilizado' : 'Manutenção');
      await db.entities.Equipamento.update(selectedEq.id, { estado: newEquipState });
    },
    onSuccess: () => {
      qc.invalidateQueries();
      handleClose();
      toast.success('Avaria registada com sucesso');
    }
  });

  const handleClose = () => {
    setSelectedEq(null); setEqSearch(''); setDiagnostico(''); setEstado('A REVER'); setComponentes(DEFAULT_COMPONENTES); setDocs([]); setCreateEq(false);
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
            <div className="space-y-2">
              <Label className="font-semibold">Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS_AVARIA.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
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
                    <Input placeholder="Nome, nº série..." value={eqSearch} onChange={e => setEqSearch(e.target.value)} className="flex-1" />
                    <SmartScanner onResult={v => setEqSearch(v)} label="Ler Equipamento" />
                  </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {availableEq.map(eq => (
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

          <div>
            <Label className="font-semibold">Componentes</Label>
            <div className="mt-2">
              <ComponentSelector componentes={componentes} onChange={setComponentes} />
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
