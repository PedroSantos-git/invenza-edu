import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Pencil, FileSpreadsheet, FileDown } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import FileUpload from '@/components/shared/FileUpload';
import ImportDialog from '@/components/shared/ImportDialog';
import SmartScanner from '@/components/shared/SmartScanner';
import EquipamentoDetail from '@/components/equipamentos/EquipamentoDetail';
import { toast } from 'sonner';
import { gerarPDFEquipamento } from '@/utils/pdfGenerator';
import { useAuth } from '@/lib/AuthContext';

const PROTECTED_EMAIL = 'pedro.mf.santos@outlook.pt';

export default function Equipamentos() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.email === PROTECTED_EMAIL || user?.role === 'admin';
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('DISPONÍVEL');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});

  const { data: equipamentos = [], isLoading } = useQuery({
    queryKey: ['equipamentos'],
    queryFn: () => db.entities.Equipamento.list('-created_at')
  });
  const { data: tipos = [] } = useQuery({
    queryKey: ['tipos-equipamento'], queryFn: () => db.entities.TipoEquipamento.list('-created_date')
  });
  const { data: pdfTemplates = [] } = useQuery({
    queryKey: ['doc-templates'], queryFn: () => db.entities.DocumentoTemplate.list()
  });

  const tiposAtivos = tipos.filter(t => t.ativo !== false);
  const todosOsTipos = [...new Set([...tiposAtivos.map(t => t.nome), ...equipamentos.map(e => e.tipo).filter(Boolean)])];

  const saveMutation = useMutation({
    mutationFn: (data) => selected?.id
      ? db.entities.Equipamento.update(selected.id, data)
      : db.entities.Equipamento.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipamentos'] });
      setFormOpen(false);
      setSelected(null);
      toast.success(selected?.id ? 'Equipamento atualizado' : 'Equipamento criado');
    }
  });

  const openForm = (eq = null) => {
    setSelected(eq);
    setForm(eq || { tipo: tiposAtivos[0]?.nome || 'Portátil', estado: 'DISPONÍVEL', documentos: [] });
    setFormOpen(true);
  };

  const filtered = (equipamentos || [])
    .filter(eq => {
      const matchSearch = !search || [eq.numero_serie, eq.designacao, eq.marca, eq.modelo].some(f => f?.toLowerCase().includes(search.toLowerCase()));
      const matchEstado = filtroEstado === 'todos' || eq.estado === filtroEstado;
      const matchTipo = filtroTipo === 'todos' || eq.tipo === filtroTipo;
      return matchSearch && matchEstado && matchTipo;
    })
    .sort((a, b) => {
      // Primeiro por data de criação (descendente) - já vem do DB, mas reforçamos aqui
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      if (dateB - dateA !== 0) return dateB - dateA;
      
      // Segundo por designação (ascendente)
      return (a.designacao || '').localeCompare(b.designacao || '');
    });

  const handlePDF = (eq, e) => {
    e.stopPropagation();
    gerarPDFEquipamento(eq, pdfTemplates);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equipamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">{equipamentos.length} equipamento(s) registado(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />Importar
          </Button>
          <Button onClick={() => openForm()} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />Novo Equipamento
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Nome, nº série, imobilizado..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <SmartScanner onResult={v => setSearch(v)} label="Pesquisar por scanner" />
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os estados</SelectItem>
            <SelectItem value="DISPONÍVEL">Disponível</SelectItem>
            <SelectItem value="EMPRESTADO">Emprestado</SelectItem>
            <SelectItem value="EM AVARIA">Em Avaria</SelectItem>
            <SelectItem value="INUTILIZADO">Inutilizado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {todosOsTipos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nº Série</TableHead>
              <TableHead className="hidden md:table-cell">Imobilizado</TableHead>
              <TableHead>Designação</TableHead>
              <TableHead className="hidden sm:table-cell">Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">A carregar...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum equipamento encontrado</TableCell></TableRow>
            ) : (
              filtered.map(eq => (
                <TableRow key={eq.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => { setSelected(eq); setDetailOpen(true); }}>
                  <TableCell className="font-mono text-xs">{eq.numero_serie}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{eq.numero_imobilizado}</TableCell>
                  <TableCell className="font-medium">{eq.designacao}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{eq.tipo}</TableCell>
                  <TableCell><StatusBadge status={eq.estado} /></TableCell>
                  <TableCell className="text-right flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" title="Gerar PDF" onClick={e => handlePDF(eq, e)}><FileDown className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); openForm(eq); }}><Pencil className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Form dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.id ? 'Editar Equipamento' : 'Novo Equipamento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nº Série *</Label>
                <div className="flex gap-2">
                  <Input value={form.numero_serie || ''} onChange={e => setForm({...form, numero_serie: e.target.value})} className="flex-1" />
                  <SmartScanner onResult={v => setForm({...form, numero_serie: v})} label="Ler Nº Série" />
                </div>
              </div>
              <div>
                <Label>Nº Imobilizado</Label>
                <div className="flex gap-2">
                  <Input value={form.numero_imobilizado || ''} onChange={e => setForm({...form, numero_imobilizado: e.target.value})} className="flex-1" />
                  <SmartScanner onResult={v => setForm({...form, numero_imobilizado: v})} label="Ler Nº Imobilizado" />
                </div>
              </div>
            </div>
            <div>
              <Label>Designação *</Label>
              <div className="flex gap-2">
                <Input value={form.designacao || ''} onChange={e => setForm({...form, designacao: e.target.value})} className="flex-1" />
                <SmartScanner onResult={v => setForm({...form, designacao: v})} label="Ler Designação" mode="ocr_only" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Tipo *</Label>
                {tiposAtivos.length > 0 ? (
                  <Select value={form.tipo || ''} onValueChange={v => setForm({...form, tipo: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {tiposAtivos.map(t => <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex gap-2">
                    <Input value={form.tipo || ''} onChange={e => setForm({...form, tipo: e.target.value})} placeholder="Ex: Portátil" className="flex-1" />
                    <SmartScanner onResult={v => setForm({...form, tipo: v})} label="Ler Tipo" mode="ocr_only" />
                  </div>
                )}
              </div>
              <div>
                <Label>Marca</Label>
                <div className="flex gap-2">
                  <Input value={form.marca || ''} onChange={e => setForm({...form, marca: e.target.value})} className="flex-1" />
                  <SmartScanner onResult={v => setForm({...form, marca: v})} label="Ler Marca" mode="ocr_only" />
                </div>
              </div>
              <div>
                <Label>Modelo</Label>
                <div className="flex gap-2">
                  <Input value={form.modelo || ''} onChange={e => setForm({...form, modelo: e.target.value})} className="flex-1" />
                  <SmartScanner onResult={v => setForm({...form, modelo: v})} label="Ler Modelo" mode="ocr_only" />
                </div>
              </div>
            </div>
            <div><Label>Data de Entrada</Label><Input type="date" value={form.data_entrada || ''} onChange={e => setForm({...form, data_entrada: e.target.value})} /></div>
            <div>
              <Label>Notas</Label>
              <div className="flex gap-2 items-start">
                <Textarea value={form.notas || ''} onChange={e => setForm({...form, notas: e.target.value})} className="flex-1" />
                <SmartScanner onResult={v => setForm({...form, notas: (form.notas ? form.notas + '\n' : '') + v})} label="Ler Notas" mode="ocr_only" />
              </div>
            </div>
            <FileUpload files={form.documentos || []} onChange={docs => setForm({...form, documentos: docs})} isAdmin={isAdmin} />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'A guardar...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selected && (
        <EquipamentoDetail open={detailOpen} onClose={() => setDetailOpen(false)} equipamento={selected} onEdit={() => { setDetailOpen(false); openForm(selected); }} isAdmin={isAdmin} />
      )}

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entityName="Equipamento"
        queryKey="equipamentos"
        jsonSchema={{
          type: 'object',
          properties: {
            numero_serie: { type: 'string' },
            numero_imobilizado: { type: 'string' },
            designacao: { type: 'string' },
            tipo: { type: 'string' },
            marca: { type: 'string' },
            modelo: { type: 'string' },
            estado: { type: 'string', enum: ['DISPONÍVEL', 'EMPRESTADO', 'EM AVARIA', 'INUTILIZADO'] }
          }
        }}
      />
    </div>
  );
}
