import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// Note: useQueryClient used in sub-components below
import { db, requireSupabase } from '@/api/db';

import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Search, AlertTriangle, Plus, FileDown, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import PageHeader from '@/components/shared/PageHeader';
import FileUpload from '@/components/shared/FileUpload';
import DocumentViewer from '@/components/shared/DocumentViewer';
import AcessoriosCheck, { ACESSORIOS } from '@/components/shared/AcessoriosCheck';
import SmartScanner from '@/components/shared/SmartScanner';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CornerDownLeft } from 'lucide-react';
import { gerarPDFDevolucao } from '@/utils/pdfGenerator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';
import { isMainEquipment } from '@/utils/kitUtils';

const PROTECTED_EMAIL = 'pedro.mf.santos@outlook.pt';

const SortButton = ({ column, currentSort, onSort, label }) => {
  const isSorted = currentSort.column === column;
  return (
    <Button 
      variant="ghost" 
      size="sm" 
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => onSort(column)}
    >
      <span>{label}</span>
      {isSorted ? (
        currentSort.ascending ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : (
          <ArrowDown className="ml-2 h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4 opacity-0 group-hover:opacity-100" />
      )}
    </Button>
  );
};

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
    <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
      <p className="text-sm font-semibold">Criar novo equipamento</p>
      <div><Label>Designação *</Label><Input value={form.designacao} onChange={e => setForm({...form, designacao: e.target.value})} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Nº Série *</Label><Input value={form.numero_serie} onChange={e => setForm({...form, numero_serie: e.target.value})} /></div>
        <div><Label>Marca</Label><Input value={form.marca} onChange={e => setForm({...form, marca: e.target.value})} /></div>
        <div><Label>Modelo</Label><Input value={form.modelo} onChange={e => setForm({...form, modelo: e.target.value})} /></div>
        <div className="col-span-1">
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

function MiniPessoaForm({ onCreated, onCancel }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ nome: '', tipo: 'Aluno', ativo: true });
  const mut = useMutation({
    mutationFn: () => db.entities.Pessoa.create(form),
    onSuccess: (p) => { qc.invalidateQueries({ queryKey: ['pessoas'] }); onCreated(p); toast.success('Pessoa criada'); }
  });
  return (
    <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
      <p className="text-sm font-semibold">Criar nova pessoa</p>
      <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Tipo</Label>
          <Select value={form.tipo} onValueChange={v => setForm({...form, tipo: v})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="Aluno">Aluno</SelectItem><SelectItem value="Docente">Docente</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label>Turma</Label><Input value={form.turma || ''} onChange={e => setForm({...form, turma: e.target.value})} /></div>
        <div><Label>Email</Label><Input value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} /></div>
        <div><Label>NIF</Label><Input value={form.nif || ''} onChange={e => setForm({...form, nif: e.target.value})} /></div>
        <div className="col-span-2"><Label>Telefone</Label><Input value={form.telefone || ''} onChange={e => setForm({...form, telefone: e.target.value})} /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={() => mut.mutate()} disabled={!form.nome || mut.isPending}>Criar</Button>
      </div>
    </div>
  );
}

export default function Devolucoes() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.email === PROTECTED_EMAIL || user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [sort, setSort] = useState({ column: 'created_at', ascending: false });
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [editMode, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});

  // For searching loans
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState(null);

  // For creating a "free" return (no active loan)
  const [modoLivre, setModoLivre] = useState(false);
  const [eqSearch, setEqSearch] = useState('');
  const [selectedEq, setSelectedEq] = useState(null);
  const [pessoaSearch, setPessoaSearch] = useState('');
  const [selectedPessoa, setSelectedPessoa] = useState(null);
  const [createEq, setCreateEq] = useState(false);
  const [createPessoa, setCreatePessoa] = useState(false);

  const [estadoEquipamento, setEstadoEquipamento] = useState('A REVER');
  const [notas, setNotas] = useState('');
  const [docs, setDocs] = useState([]);
  const [acessoriosDevolvidos, setAcessoriosDevolvidos] = useState({});
  const [step, setStep] = useState(1);

  const { data: devolucoes = [], isLoading } = useQuery({
    queryKey: ['devolucoes', sort],
    queryFn: () => db.entities.Devolucao.list(`${sort.ascending ? '' : '-'}${sort.column}`)
  });
  const { data: emprestimosAtivos = [] } = useQuery({
    queryKey: ['emprestimos-ativos'],
    queryFn: () => db.entities.Emprestimo.filter({ estado: 'ATIVO' }, '-created_date')
  });
  const { data: equipamentosDisponiveis = [] } = useQuery({
    queryKey: ['equipamentos', 'disponiveis'], 
    queryFn: () => db.entities.Equipamento.filter({ estado: ['Rececionado', 'Recondicionamento'] })
  });
  const { data: equipamentosTodos = [] } = useQuery({
    queryKey: ['equipamentos', 'todos'], queryFn: () => db.entities.Equipamento.list()
  });
  const { data: pessoas = [] } = useQuery({
    queryKey: ['pessoas'], queryFn: () => db.entities.Pessoa.list()
  });
  const { data: pdfTemplates = [] } = useQuery({
    queryKey: ['doc-templates'], queryFn: () => db.entities.DocumentoTemplate.list()
  });

  const devolveMutation = useMutation({
    mutationFn: async () => {
      const hoje = new Date().toISOString().split('T')[0];
      let empInfo, eqId, pessoaId, eqInfo, pessoaInfo, empId, eqSnFinal, pessoaNifFinal;

      if (modoLivre) {
        eqId = selectedEq.id;
        pessoaId = selectedPessoa.id;
        eqInfo = `${selectedEq.tipo} ${selectedEq.marca} ${selectedEq.modelo}`.trim() || selectedEq.designacao;
        pessoaInfo = selectedPessoa.nome;
        const eqSn = selectedEq.numero_serie;
        const pessoaNif = selectedPessoa.nif;
        // Create a fake loan first
        const empCriado = await db.entities.Emprestimo.create({
          equipamento_id: eqId, pessoa_id: pessoaId,
          equipamento_info: eqInfo, 
          equipamento_sn: eqSn,
          pessoa_info: pessoaInfo,
          pessoa_nif: pessoaNif,
          data_emprestimo: hoje, estado: 'ATIVO', notas_entrega: 'Criado automaticamente na devolução'
        });
        empId = empCriado.id;
        eqSnFinal = eqSn;
        pessoaNifFinal = pessoaNif;
      } else {
        empInfo = selectedEmp;
        eqId = selectedEmp.equipamento_id;
        pessoaId = selectedEmp.pessoa_id;
        eqInfo = selectedEmp.equipamentoLabel || selectedEmp.equipamento_info;
        eqSnFinal = selectedEmp.equipamentoSn || selectedEmp.equipamento_sn || selectedEmp.numero_serie;
        pessoaInfo = selectedEmp.pessoaNome || selectedEmp.pessoa_info;
        pessoaNifFinal = selectedEmp.pessoaNif || selectedEmp.pessoa_nif || selectedEmp.nif;
        empId = selectedEmp.id;
      }

      // IDENTIFICAR O KIT COMPLETO PARA A DEVOLUÇÃO
      // 1. Obter o equipamento base para saber o imobilizado
      const { data: baseEq } = await db.client.from('equipamentos').select('numero_imobilizado').eq('id', eqId).single();
      const imob = baseEq?.numero_imobilizado?.trim();
      
      let kitItems = [];
      if (imob) {
        const { data: allKit } = await db.client.from('equipamentos').select('*').eq('numero_imobilizado', imob);
        kitItems = allKit || [];
      } else {
        // Se não tem imobilizado, o kit é apenas o item atual
        const { data: current } = await db.client.from('equipamentos').select('*').eq('id', eqId).single();
        kitItems = [current];
      }

      // O item principal do kit para registar a avaria/devolução mestre
      const mainEq = kitItems.find(isMainEquipment) || kitItems[0];

      if (kitItems.length > 1) {
        toast.info(`Conjunto detetado (${kitItems.length} itens)`, {
          description: `A processar devolução para: ${kitItems.map(i => i.tipo).join(', ')}`
        });
      }

      // 1. Criar Devolução (apenas uma para o conjunto)
      const payloadDevolucao = {
        emprestimo_id: empId,
        equipamento_id: mainEq.id, // Registar no principal
        pessoa_id: pessoaId,
        equipamento_info: kitItems.length > 1 ? `${eqInfo} (+ conjunto)` : eqInfo,
        pessoa_info: pessoaInfo,
        data_devolucao: hoje,
        estado_equipamento: estadoEquipamento === 'OK' ? 'BOM ESTADO' : estadoEquipamento,
        notas: kitItems.length > 1 ? `${notas}\n(Devolução de conjunto com ${kitItems.length} itens via imobilizado ${imob})`.trim() : notas,
        documentos: docs,
        acessorios_devolvidos: acessoriosDevolvidos
      };

      const devolucao = await db.entities.Devolucao.create(payloadDevolucao);

      // 2. Processar Avaria e Estados para TODOS os itens do kit
      for (const item of kitItems) {
        // Atualizar estado do equipamento
        const novoEstadoEq = estadoEquipamento === 'OK' ? 'Recondicionamento' : 'Manutenção';
        await db.entities.Equipamento.update(item.id, { estado: novoEstadoEq });

        // Se for avaria, criar uma para cada item (ou apenas para o principal? o utilizador disse conjunto vai para a mesma avaria)
        // Vamos criar uma avaria por item para rastreio técnico individual, mas marcadas como conjunto
        if (estadoEquipamento !== 'OK') {
          const { data: maxAvaria } = await db.client.from('avarias').select('numero_avaria').order('numero_avaria', { ascending: false }).limit(1).maybeSingle();
          const nextNumero = maxAvaria?.numero_avaria ? maxAvaria.numero_avaria + 1 : 1001;
          
          await db.entities.Avaria.create({
            numero_avaria: nextNumero,
            equipamento_id: item.id,
            equipamento_info: `${item.tipo} ${item.marca} ${item.modelo}`.trim() || item.designacao,
            origem: 'DEVOLUÇÃO',
            devolucao_id: devolucao.id,
            estado: 'A REVER',
            diagnostico: kitItems.length > 1 ? `Avaria de conjunto (Imob: ${imob})` : 'A rever...',
            componentes: { 
              ecra: 'DESCONHECIDO', disco: 'DESCONHECIDO', ram: 'DESCONHECIDO', 
              board: 'DESCONHECIDO', bateria: 'DESCONHECIDO', ventoinha: 'DESCONHECIDO',
              teclado: 'DESCONHECIDO', touchpad: 'DESCONHECIDO' 
            },
            historico_estados: [{ tipo: 'estado', estado_novo: 'A REVER', data: new Date().toISOString(), utilizador: 'Sistema (Devolução Conjunto)' }]
          });
        }
      }

      // 3. Atualizar Empréstimo Base
      const empEstado = estadoEquipamento === 'OK' ? 'DEVOLVIDO' : (estadoEquipamento === 'COM DANOS' ? 'DANOS PARA REVISÃO' : 'PARA REVISÃO');
      await db.entities.Emprestimo.update(empId, { 
        estado: empEstado, 
        notas_devolucao: kitItems.length > 1 ? `${notas} (Conjunto devolvido)`.trim() : notas 
      });

      return { devolucao, eqInfo, pessoaInfo };
    },
    onSuccess: ({ devolucao, eqInfo, pessoaInfo }) => {
      qc.invalidateQueries();
      gerarPDFDevolucao({ ...devolucao, equipamento_info: eqInfo, pessoa_info: pessoaInfo, acessorios_devolvidos: acessoriosDevolvidos }, pdfTemplates);
      resetForm();
      toast.success('Devolução registada. PDF gerado.');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      // 1. Atualizar a devolução
      const updatedDev = await db.entities.Devolucao.update(id, {
        acessorios_devolvidos: data.acessorios_devolvidos,
        notas: data.notas,
        documentos: data.documentos
      });

      // 2. Sincronizar com o empréstimo (opcional, mas bom para consistência)
      if (updatedDev.emprestimo_id) {
        await db.entities.Emprestimo.update(updatedDev.emprestimo_id, {
          acessorios_devolvidos: data.acessorios_devolvidos,
          notas_devolucao: data.notas
        });
      }

      return updatedDev;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devolucoes'] });
      qc.invalidateQueries({ queryKey: ['emprestimos'] });
      setEditOpen(false);
      setDetailOpen(false);
      toast.success('Alterações gravadas com sucesso');
    },
    onError: (err) => {
      toast.error('Erro ao atualizar: ' + err.message);
    }
  });

  const resetForm = () => {
    setFormOpen(false); setSelectedEmp(null); setEmpSearch('');
    setEstadoEquipamento('A REVER'); setNotas(''); setDocs([]);
    setAcessoriosDevolvidos({}); setStep(1); setModoLivre(false);
    setSelectedEq(null); setSelectedPessoa(null); setEqSearch(''); setPessoaSearch('');
    setCreateEq(false); setCreatePessoa(false);
  };

  const equipamentoById = React.useMemo(
    () => new Map((equipamentosTodos || []).map(eq => [eq.id, eq])),
    [equipamentosTodos]
  );

  const pessoaById = React.useMemo(
    () => new Map((pessoas || []).map(p => [p.id, p])),
    [pessoas]
  );

  const formatEquipamento = (eq) => {
    if (!eq) return '';
    const parts = [eq.tipo, eq.marca, eq.modelo].filter(Boolean);
    return parts.join(' ').trim();
  };

  const emprestimosAtivosDecorados = (emprestimosAtivos || []).map(emp => {
    const eq = equipamentoById.get(emp.equipamento_id);
    const pessoa = pessoaById.get(emp.pessoa_id);
    const equipamentoLabel = formatEquipamento(eq) || emp.equipamento_info || emp.designacao || '—';
    const equipamentoSn = eq?.numero_serie || emp.equipamento_sn || emp.numero_serie || '—';
    const pessoaNome = pessoa?.nome || emp.pessoa_info || '—';
    const pessoaNif = pessoa?.nif || emp.pessoa_nif || emp.nif || '—';
    return { ...emp, equipamentoLabel, equipamentoSn, pessoaNome, pessoaNif };
  });

  const filteredEmp = emprestimosAtivosDecorados.filter(e =>
    empSearch === '' || [
      e.equipamentoLabel,
      e.equipamentoSn,
      e.pessoaNome,
      e.pessoaNif
    ].some(f => f?.toLowerCase().includes(empSearch.toLowerCase()))
  );

  const filteredEq = equipamentosDisponiveis.filter(e =>
    eqSearch === '' || [e.numero_serie, e.designacao, e.marca, e.modelo].some(f => f?.toLowerCase().includes(eqSearch.toLowerCase()))
  );

  const filteredPessoas = pessoas.filter(p =>
    pessoaSearch === '' || [p.nome, p.email, p.turma, p.nif, p.telefone].some(f => f?.toLowerCase().includes(pessoaSearch.toLowerCase()))
  );

  const handleSort = (column) => {
    setSort(prev => ({
      column,
      ascending: prev.column === column ? !prev.ascending : true
    }));
  };

  const handleEdit = (dev) => {
    setEditForm({
      id: dev.id,
      acessorios_devolvidos: dev.acessorios_devolvidos || {},
      notas: dev.notas || '',
      documentos: dev.documentos || []
    });
    setEditOpen(true);
  };

  const devolucoesDecoradas = (devolucoes || []).map(d => {
    const eq = equipamentoById.get(d.equipamento_id);
    const pessoa = pessoaById.get(d.pessoa_id);
    const equipamentoLabel = formatEquipamento(eq) || d.equipamento_info || d.designacao || '—';
    const equipamentoSn = eq?.numero_serie || d.equipamento_sn || d.numero_serie || '—';
    const pessoaNome = pessoa?.nome || d.pessoa_info || '—';
    const pessoaNif = pessoa?.nif || d.pessoa_nif || d.nif || '—';
    return { ...d, equipamentoLabel, equipamentoSn, pessoaNome, pessoaNif };
  });

  const filteredDev = devolucoesDecoradas.filter(d => {
    const matchSearch = !search || [
      d.equipamentoLabel,
      d.equipamentoSn,
      d.pessoaNome,
      d.pessoaNif
    ].some(f => f?.toLowerCase().includes(search.toLowerCase()));
    const matchEstado = filtroEstado === 'todos' || d.estado_equipamento === filtroEstado;
    return matchSearch && matchEstado;
  });

  // Acessórios entregues do empréstimo selecionado
  const acessoriosEntregues = selectedEmp?.acessorios_entregues || {};

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Devoluções" 
        subtitle={
          filteredDev.length === (devolucoes?.length || 0)
            ? `${devolucoes?.length || 0} devolução(ões) registada(s)`
            : `${filteredDev.length} de ${devolucoes?.length || 0} devolução(ões) (filtrado)`
        } 
        action={() => setFormOpen(true)} 
        actionLabel="Nova Devolução" 
        actionIcon={CornerDownLeft} 
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Pesquisar devoluções..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <SmartScanner onResult={v => setSearch(v)} label="Pesquisar por scanner" />
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            <SelectItem value="BOM ESTADO">Bom Estado</SelectItem>
            <SelectItem value="A REVER">A Rever</SelectItem>
            <SelectItem value="COM DANOS">Com Danos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Equipamento</TableHead>
              <TableHead>Nº Série</TableHead>
              <TableHead>Pessoa</TableHead>
              <TableHead>NIF</TableHead>
              <TableHead className="hidden sm:table-cell">Data</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">A carregar...</TableCell></TableRow>
            ) : filteredDev.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma devolução encontrada</TableCell></TableRow>
            ) : (
              filteredDev.map(d => (
                <TableRow key={d.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => { setDetailItem(d); setDetailOpen(true); }}>
                  <TableCell className="font-medium">{d.equipamentoLabel}</TableCell>
                  <TableCell className="font-mono text-xs">{d.equipamentoSn}</TableCell>
                  <TableCell>{d.pessoaNome}</TableCell>
                  <TableCell className="text-sm">{d.pessoaNif}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{format(new Date(d.data_devolucao), 'dd/MM/yyyy')}</TableCell>
                  <TableCell><StatusBadge status={d.estado_equipamento} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); gerarPDFDevolucao(d, pdfTemplates); }}><FileDown className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Return dialog */}
      <Dialog open={formOpen} onOpenChange={v => { if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Devolução</DialogTitle></DialogHeader>

          {step === 1 && (
            <div className="space-y-5">
              {/* Loan selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">Empréstimo Ativo</Label>
                  {!modoLivre && <Button variant="ghost" size="sm" onClick={() => setModoLivre(true)} className="text-xs">Sem empréstimo ativo →</Button>}
                  {modoLivre && <Button variant="ghost" size="sm" onClick={() => setModoLivre(false)} className="text-xs">← Pesquisar empréstimo</Button>}
                </div>

                {!modoLivre ? (
                  selectedEmp ? (
                    <div className="p-3 rounded-lg border bg-blue-50 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium">{selectedEmp.equipamentoLabel}</p>
                          <p className="text-xs text-muted-foreground">SN: {selectedEmp.equipamentoSn} — {selectedEmp.pessoaNome} — NIF: {selectedEmp.pessoaNif} — desde {format(new Date(selectedEmp.data_emprestimo), 'dd/MM/yyyy')}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedEmp(null)}>Alterar</Button>
                      </div>
                      {selectedEmp.notas_entrega && (
                        <div className="p-2 bg-amber-50 rounded text-xs border border-amber-200">
                          <span className="font-semibold">Notas de entrega: </span>{selectedEmp.notas_entrega}
                        </div>
                      )}
                      {Object.values(acessoriosEntregues).some(Boolean) && (
                        <div className="p-2 bg-blue-50/80 rounded text-xs">
                          <span className="font-semibold">Acessórios entregues: </span>
                          {ACESSORIOS.filter(a => acessoriosEntregues[a.key]).map(a => a.label).join(', ')}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <Input placeholder="Pesquisar por série, equipamento, pessoa ou NIF..." value={empSearch} onChange={e => setEmpSearch(e.target.value)} className="flex-1" />
                        <SmartScanner onResult={v => setEmpSearch(v)} label="Ler Empréstimo" />
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1 mt-1">
                        {filteredEmp.map(emp => (
                          <button key={emp.id} onClick={() => setSelectedEmp(emp)} className="w-full text-left p-2 rounded hover:bg-muted text-sm">
                            <span className="font-medium">{emp.equipamentoSn} — {emp.equipamentoLabel}</span> — {emp.pessoaNome} ({emp.pessoaNif})
                          </button>
                        ))}
                        {filteredEmp.length === 0 && (
                          <div className="p-2">
                            <p className="text-sm text-muted-foreground">Nenhum empréstimo ativo.</p>
                          </div>
                        )}
                      </div>
                    </>
                  )
                ) : (
                  // Free mode: choose equipment and person
                  <div className="space-y-4 p-3 border rounded-lg bg-muted/20">
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">Será criado um empréstimo automaticamente para registar esta devolução.</p>
                    <div>
                      <Label className="text-xs font-semibold">Equipamento</Label>
                      {selectedEq ? (
                        <div className="p-2 rounded border bg-emerald-50 flex justify-between items-center mt-1">
                          <span className="text-sm">{selectedEq.designacao} ({selectedEq.numero_serie})</span>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedEq(null)}>Alterar</Button>
                        </div>
                      ) : createEq ? (
                        <MiniEquipamentoForm onCreated={eq => { setSelectedEq(eq); setCreateEq(false); }} onCancel={() => setCreateEq(false)} />
                      ) : (
                        <>
                          <div className="flex gap-2 mt-1">
                            <Input placeholder="Nome, nº série..." value={eqSearch} onChange={e => setEqSearch(e.target.value)} className="flex-1" />
                            <SmartScanner onResult={v => setEqSearch(v)} label="Ler Equipamento" />
                          </div>
                          <div className="max-h-32 overflow-y-auto space-y-1 mt-1">
                            {filteredEq.map(eq => (
                              <button key={eq.id} onClick={() => setSelectedEq(eq)} className="w-full text-left p-1.5 rounded hover:bg-muted text-sm flex justify-between items-center">
                                <span>{eq.designacao} — {eq.numero_serie}</span>
                                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase font-bold">{eq.estado}</span>
                              </button>
                            ))}
                            {eqSearch && filteredEq.length === 0 && (
                              <Button size="sm" variant="outline" className="mt-1" onClick={() => setCreateEq(true)}><Plus className="w-3 h-3 mr-1" />Criar equipamento</Button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Pessoa</Label>
                      {selectedPessoa ? (
                        <div className="p-2 rounded border bg-blue-50 flex justify-between items-center mt-1">
                          <span className="text-sm">{selectedPessoa.nome}</span>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedPessoa(null)}>Alterar</Button>
                        </div>
                      ) : createPessoa ? (
                        <MiniPessoaForm onCreated={p => { setSelectedPessoa(p); setCreatePessoa(false); }} onCancel={() => setCreatePessoa(false)} />
                      ) : (
                        <>
                          <div className="flex gap-2 mt-1">
                            <Input placeholder="Nome, email, NIF..." value={pessoaSearch} onChange={e => setPessoaSearch(e.target.value)} className="flex-1" />
                            <SmartScanner onResult={v => setPessoaSearch(v)} label="Ler Pessoa" />
                          </div>
                          <div className="max-h-32 overflow-y-auto space-y-1 mt-1">
                            {filteredPessoas.map(p => (
                              <button key={p.id} onClick={() => setSelectedPessoa(p)} className="w-full text-left p-1.5 rounded hover:bg-muted text-sm flex justify-between items-center">
                                <span>{p.nome} — {p.tipo} {p.turma ? `(${p.turma})` : ''}</span>
                                {!p.ativo && <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded uppercase font-bold">Inativo</span>}
                              </button>
                            ))}
                            {pessoaSearch && filteredPessoas.length === 0 && (
                              <Button size="sm" variant="outline" className="mt-1" onClick={() => setCreatePessoa(true)}><Plus className="w-3 h-3 mr-1" />Criar pessoa</Button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label className="font-semibold">Estado do Equipamento na Devolução</Label>
                <RadioGroup value={estadoEquipamento} onValueChange={setEstadoEquipamento} className="space-y-2">
                  {[
                    { value: 'A REVER', label: 'A rever', desc: 'Necessita de verificação técnica' },
                    { value: 'OK', label: 'OK', desc: 'Equipamento em bom estado (não abre avaria)' },
                    { value: 'COM DANOS', label: 'Com danos', desc: 'Apresenta danos visíveis ou funcionais' }
                  ].map(opt => (
                    <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${estadoEquipamento === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                      <RadioGroupItem value={opt.value} className="mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {estadoEquipamento !== 'OK' && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">Será criada automaticamente uma avaria com estado "A REVER" para este equipamento.</p>
                </div>
              )}

              {estadoEquipamento === 'OK' && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <CornerDownLeft className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-emerald-800">O equipamento será marcado como "Recondicionamento" e ficará disponível em breve.</p>
                </div>
              )}

              <AcessoriosCheck value={acessoriosDevolvidos} onChange={setAcessoriosDevolvidos} title="Acessórios devolvidos" />
              <div>
                <Label>Notas de Devolução</Label>
                <div className="flex gap-2 items-start">
                  <Textarea value={notas} onChange={e => setNotas(e.target.value)} className="flex-1" />
                  <SmartScanner onResult={v => setNotas((notas ? notas + '\n' : '') + v)} label="Ler Notas" mode="ocr_only" />
                </div>
              </div>
              <FileUpload files={docs} onChange={setDocs} label="Fotos/Documentos da Devolução" isAdmin={isAdmin} />

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={resetForm}>Cancelar</Button>
                <Button onClick={() => setStep(2)} disabled={!modoLivre ? !selectedEmp : (!selectedEq || !selectedPessoa)}>Continuar</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <h3 className="font-semibold text-sm">Confirmar Devolução</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Equipamento</p><p className="font-medium">{selectedEmp?.equipamento_info || selectedEq?.designacao}</p></div>
                  <div><p className="text-xs text-muted-foreground">Pessoa</p><p className="font-medium">{selectedEmp?.pessoa_info || selectedPessoa?.nome}</p></div>
                  <div><p className="text-xs text-muted-foreground">Estado</p><StatusBadge status={estadoEquipamento} /></div>
                </div>
                {Object.values(acessoriosDevolvidos).some(Boolean) && (
                  <div><p className="text-xs text-muted-foreground">Acessórios devolvidos</p><p className="text-sm">{ACESSORIOS.filter(a => acessoriosDevolvidos[a.key]).map(a => a.label).join(', ')}</p></div>
                )}
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  {estadoEquipamento === 'OK' 
                    ? 'O equipamento ficará disponível para novo empréstimo. Um PDF será gerado.' 
                    : 'Avaria será criada automaticamente. Um PDF será gerado.'}
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                <Button onClick={() => devolveMutation.mutate()} disabled={devolveMutation.isPending}>
                  {devolveMutation.isPending ? 'A registar...' : 'Confirmar Devolução'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {detailItem && (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Detalhe da Devolução</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg text-sm">
                <div><p className="text-xs text-muted-foreground">Equipamento</p><p className="font-medium">{detailItem.equipamento_info}</p></div>
                <div><p className="text-xs text-muted-foreground">Pessoa</p><p className="font-medium">{detailItem.pessoa_info}</p></div>
                <div><p className="text-xs text-muted-foreground">Data Devolução</p><p>{format(new Date(detailItem.data_devolucao), 'dd/MM/yyyy')}</p></div>
                <div><p className="text-xs text-muted-foreground">Estado</p><StatusBadge status={detailItem.estado_equipamento} /></div>
              </div>
              {detailItem.notas && <div><p className="text-xs text-muted-foreground font-semibold">Notas</p><p className="text-sm mt-1 p-2 bg-muted/30 rounded">{detailItem.notas}</p></div>}
              {detailItem.acessorios_devolvidos && Object.values(detailItem.acessorios_devolvidos).some(Boolean) && (
                <div>
                  <p className="text-xs text-muted-foreground font-semibold">Acessórios Devolvidos</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {ACESSORIOS.filter(a => detailItem.acessorios_devolvidos[a.key]).map(a => (
                      <span key={a.key} className="text-xs bg-emerald-100 text-emerald-700 rounded px-2 py-0.5">{a.label}</span>
                    ))}
                  </div>
                </div>
              )}

              {detailItem.documentos?.filter(d => d.ativo !== false).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground font-semibold">Documentos</p>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {detailItem.documentos.filter(d => d.ativo !== false).map((doc, i) => (
                      <div 
                        key={i} 
                        onClick={() => setSelectedDoc(doc)}
                        className="p-2 rounded border hover:bg-muted/50 text-center text-xs cursor-pointer truncate"
                      >
                        {doc.nome}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => handleEdit(detailItem)}>
                  Editar Devolução
                </Button>
                <Button variant="outline" size="sm" onClick={() => { gerarPDFDevolucao(detailItem, pdfTemplates); }}>
                  <FileDown className="w-4 h-4 mr-1" />PDF
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <DocumentViewer 
        open={!!selectedDoc} 
        onClose={() => setSelectedDoc(null)} 
        document={selectedDoc} 
      />

      {/* Edit Dialog */}
      <Dialog open={editMode} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Devolução</DialogTitle>
            <DialogDescription>Atualize os acessórios devolvidos, notas e documentos.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-4">
              <AcessoriosCheck 
                value={editForm.acessorios_devolvidos} 
                onChange={(v) => setEditForm({...editForm, acessorios_devolvidos: v})} 
                title="Acessórios devolvidos" 
              />

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Notas de Devolução</Label>
                <Textarea 
                  value={editForm.notas} 
                  onChange={e => setEditForm({...editForm, notas: e.target.value})}
                  className="min-h-[100px]"
                />
              </div>

              <FileUpload 
                files={editForm.documentos} 
                onChange={v => setEditForm({...editForm, documentos: v})} 
                label="Fotos/Documentos da Devolução" 
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button 
              onClick={() => updateMutation.mutate({ id: editForm.id, data: editForm })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'A gravar...' : 'Gravar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
