import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { EmailService } from '@/api/emailService';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Search, Plus, FileDown, Mail, Loader2, ArrowUpDown, ArrowUp, ArrowDown, FileText, Upload, Download } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import PageHeader from '@/components/shared/PageHeader';
import FileUpload from '@/components/shared/FileUpload';
import DocumentViewer from '@/components/shared/DocumentViewer';
import AcessoriosCheck from '@/components/shared/AcessoriosCheck';
import SmartScanner from '@/components/shared/SmartScanner';
import RichTextEditor from '@/components/shared/RichTextEditor';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { gerarPDFEmprestimo, gerarRelatorioImportacaoPDF, gerarPDFEmprestimoDiretoAluno, exportDocument } from '@/utils/pdfGenerator';
import { useAuth } from '@/lib/AuthContext';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { groupEquipmentsIntoKits, isMainEquipment } from '@/utils/kitUtils';

const PROTECTED_EMAIL = 'pedro.mf.santos@outlook.pt';

function damerauLevenshtein(a, b) {
  if (!a || !b) return 99;
  const n = a.length;
  const m = b.length;
  const matrix = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 0; i <= n; i++) matrix[i][0] = i;
  for (let j = 0; j <= m; j++) matrix[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // Deletion
        matrix[i][j - 1] + 1,      // Insertion
        matrix[i - 1][j - 1] + cost // Substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost); // Transposition
      }
    }
  }
  return matrix[n][m];
}

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

// Inline mini forms for creating equipment/person
function MiniEquipamentoForm({ onCreated, onCancel }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ designacao: '', numero_serie: '', marca: '', modelo: '', tipo: 'Portátil', estado: 'Rececionado', documentos: [] });
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

export default function Emprestimos() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.email === PROTECTED_EMAIL || user?.role === 'admin';

  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [sort, setSort] = useState({ column: 'created_at', ascending: false });
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [requestReturnOpen, setRequestReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [createEq, setCreateEq] = useState(false);
  const [createPessoa, setCreatePessoa] = useState(false);

  // Form state
  const [eqSearch, setEqSearch] = useState('');
  const [pessoaSearch, setPessoaSearch] = useState('');
  const [selectedEq, setSelectedEq] = useState(null);
  const [selectedPessoa, setSelectedPessoa] = useState(null);
  const [notas, setNotas] = useState('');
  const [acessorios, setAcessorios] = useState({});
  const [docs, setDocs] = useState([]);
  const [autorizacaoEE, setAutorizacaoEE] = useState(false);
  const [eeLevanta, setEeLevanta] = useState(false);
  const [inseridoSistema, setInseridoSistema] = useState(false);
  const [step, setStep] = useState(1);
  const [editMode, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importSummary, setImportSummary] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [pendingSuggestions, setPendingSuggestions] = useState([]);

  const { data: emprestimos = [], isLoading } = useQuery({
    queryKey: ['emprestimos', sort],
    queryFn: () => db.entities.Emprestimo.list(`${sort.ascending ? '' : '-'}${sort.column}`)
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

  const createMutation = useMutation({
    mutationFn: async () => {
      const eqNome = `${selectedEq.tipo} ${selectedEq.marca} ${selectedEq.modelo}`.trim() || selectedEq.designacao;
      
      // Identificar o kit completo para o empréstimo
      let kitItems = [selectedEq];
      const imob = selectedEq.numero_imobilizado?.trim();
      
      if (imob) {
        const { data: siblings } = await db.client
          .from('equipamentos')
          .select('*')
          .eq('numero_imobilizado', imob)
          .neq('id', selectedEq.id)
          .in('estado', ['Rececionado', 'Recondicionamento']);
        
        if (siblings && siblings.length > 0) {
          kitItems = [...kitItems, ...siblings];
        }
      }

      // Criar o registo de empréstimo (aponta para o item principal selecionado)
      const emp = await db.entities.Emprestimo.create({
        equipamento_id: selectedEq.id,
        pessoa_id: selectedPessoa.id,
        equipamento_info: eqNome,
        pessoa_info: selectedPessoa.nome,
        data_emprestimo: new Date().toISOString().split('T')[0],
        estado: 'ATIVO',
        notas_entrega: kitItems.length > 1 
          ? `${notas}\n(Conjunto com ${kitItems.length} itens detetado via imobilizado ${imob})`.trim()
          : notas,
        acessorios_entregues: acessorios,
        autorizacao_ee: autorizacaoEE,
        ee_levanta: eeLevanta,
        inserido_sistema: inseridoSistema,
        documentos_entrega: docs
      });

      // Atualizar o estado de TODOS os itens do kit
      const estadoEquipamento = selectedPessoa.tipo === 'Aluno' ? 'Aluno' : 'Docente';
      
      for (const item of kitItems) {
        await db.entities.Equipamento.update(item.id, { estado: estadoEquipamento });
      }

      return emp;
    },
    onSuccess: (emp) => {
      qc.invalidateQueries({ queryKey: ['emprestimos'] });
      qc.invalidateQueries({ queryKey: ['equipamentos'] });
      // Auto PDF
      const eqNome = `${selectedEq.tipo} ${selectedEq.marca} ${selectedEq.modelo}`.trim() || selectedEq.designacao;
      gerarPDFEmprestimo({
        ...emp,
        equipamento_info: eqNome,
        pessoa_info: selectedPessoa.nome,
        acessorios_entregues: acessorios,
        notas_entrega: notas
      }, pdfTemplates, user);
      resetForm();
      toast.success('Empréstimo registado. Auto gerado.');
    }
  });

  const requestReturnMutation = useMutation({
    mutationFn: async ({ emp, motivo }) => {
      const pessoa = pessoas.find(p => p.id === emp.pessoa_id);
      if (!pessoa?.email) throw new Error('Esta pessoa não tem email registado.');

      const cc = (pessoa.tipo === 'Aluno' && pessoa.ee_email) ? pessoa.ee_email : undefined;

      await EmailService.sendTemplate({
        tipo: 'SOLICITAR_DEVOLUCAO',
        to: pessoa.email,
        cc,
        pessoa_id: pessoa.id,
        vars: {
          pessoa: pessoa.nome,
          equipamento: emp.equipamento_info,
          motivo: motivo || '—'
        }
      });
    },
    onSuccess: () => {
      setRequestReturnOpen(false);
      setReturnReason('');
      toast.success('Pedido de devolução enviado por email.');
    },
    onError: (err) => {
      toast.error('Erro ao enviar pedido: ' + err.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      // Se tivermos devolucao_id, estamos a editar dados da devolução
      if (data.devolucao_id) {
        const { devolucao_id, acessorios_devolvidos, notas_devolucao, documentos_devolucao } = data;
        await db.entities.Devolucao.update(devolucao_id, {
          acessorios_devolvidos,
          notas: notas_devolucao,
          documentos: documentos_devolucao
        });
      }

      // Remover campos que não pertencem à tabela 'emprestimos'
      // Estes campos são virtuais ou pertencem à tabela 'devolucoes'
      const { 
        devolucao_id, 
        acessorios_devolvidos, 
        notas_devolucao, 
        documentos_devolucao,
        ...updateData 
      } = data;

      // Atualizar sempre o empréstimo (campos de entrega ou espelho da devolução)
      return await db.entities.Emprestimo.update(id, updateData);
    },
    onSuccess: () => {
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
    setFormOpen(false);
    setSelectedEq(null);
    setSelectedPessoa(null);
    setEqSearch('');
    setPessoaSearch('');
    setNotas('');
    setAcessorios({});
    setDocs([]);
    setAutorizacaoEE(false);
    setEeLevanta(false);
    setInseridoSistema(false);
    setStep(1);
    setCreateEq(false);
    setCreatePessoa(false);
  };

  const handleSort = (column) => {
    setSort(prev => ({
      column,
      ascending: prev.column === column ? !prev.ascending : true
    }));
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

  const emprestimosDecorados = (emprestimos || []).map(emp => {
    const eq = equipamentoById.get(emp.equipamento_id);
    const pessoa = pessoaById.get(emp.pessoa_id);
    const equipamentoLabel = formatEquipamento(eq) || emp.equipamento_info || emp.designacao || '—';
    const equipamentoSn = eq?.numero_serie || emp.equipamento_sn || emp.numero_serie || '—';
    const pessoaNome = pessoa?.nome || emp.pessoa_info || '—';
    const pessoaNif = pessoa?.nif || emp.pessoa_nif || emp.nif || '—';
    const devolucao = emp.devolucao?.[0];
    const devolucao_id = devolucao?.id;
    const acessorios_devolvidos = devolucao?.acessorios_devolvidos || {};
    const devolucao_notas = devolucao?.notas || '';
    const devolucao_documentos = devolucao?.documentos || [];
    
    return { 
      ...emp, 
      equipamentoLabel, 
      equipamentoSn, 
      pessoaNome, 
      pessoaNif, 
      devolucao_id,
      acessorios_devolvidos,
      devolucao_notas,
      devolucao_documentos
    };
  });

  const filteredEqRaw = equipamentosDisponiveis.filter(e =>
    eqSearch === '' || [e.numero_serie, e.numero_imobilizado, e.designacao, e.marca, e.modelo].some(f => f?.toLowerCase().includes(eqSearch.toLowerCase()))
  );

  const filteredEq = React.useMemo(() => groupEquipmentsIntoKits(filteredEqRaw), [filteredEqRaw]);

  const filteredPessoas = pessoas.filter(p =>
    (pessoaSearch === '' || [p.nome, p.email, p.turma, p.nif, p.telefone].some(f => f?.toLowerCase().includes(pessoaSearch.toLowerCase())))
  );

  const filteredRaw = (emprestimosDecorados || [])
    .filter(e => {
      const matchSearch = !searchTerm || [
        e.equipamentoLabel,
        e.equipamentoSn,
        e.equipamento_imobilizado, // Usar o campo do empréstimo se existir ou decorar
        e.pessoaNome,
        e.pessoaNif
      ].some(f => f?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchEstado = filtroEstado === 'todos' || e.estado === filtroEstado;
      return matchSearch && matchEstado;
    });

  // Agrupar empréstimos por Kit (Imobilizado)
  const filtered = React.useMemo(() => {
    const kits = new Map();
    const individual = [];

    filteredRaw.forEach(emp => {
      const eq = equipamentoById.get(emp.equipamento_id);
      const imob = eq?.numero_imobilizado?.trim();
      
      if (!imob) {
        individual.push(emp);
        return;
      }

      if (!kits.has(imob)) {
        kits.set(imob, {
          imobilizado: imob,
          main: null,
          all: [],
          isKitLoan: true
        });
      }

      const kit = kits.get(imob);
      kit.all.push(emp);

      // Tentar encontrar o empréstimo do PC como principal
      if (isMainEquipment(eq)) {
        kit.main = emp;
      }
    });

    const groupedKits = Array.from(kits.values()).map(kit => {
      const main = kit.main || kit.all[0];
      const siblingsWithLabels = kit.all
        .filter(e => e.id !== main.id)
        .map(s => {
          const sEq = equipamentoById.get(s.equipamento_id);
          return {
            ...s,
            equipamentoLabel: s.equipamentoLabel || (sEq ? `${sEq.tipo} ${sEq.marca} ${sEq.modelo}`.trim() : '—'),
            equipamentoSn: s.equipamentoSn || sEq?.numero_serie || '—'
          };
        });

      return {
        ...main,
        isKitLoan: true,
        kitLoanData: {
          count: kit.all.length,
          siblings: siblingsWithLabels
        }
      };
    });

    const combined = [...groupedKits, ...individual];
    
    // Aplicar ordenação
    return combined.sort((a, b) => {
      const valA = a[sort.column];
      const valB = b[sort.column];
      if (sort.ascending) return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });
  }, [filteredRaw, sort, equipamentoById]);

  const handleImportAuto = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setImporting(true);
    setImportProgress(0);
    const toastId = toast.loading(`A processar ${files.length} documento(s)...`);
    const results = {
      sucesso: [],
      sugestoes: [],
      falhas: [], // Ficheiros para o ZIP
      erro: {
        'Equipamento não encontrado': [],
        'Pessoa não encontrada': [],
        'Estado inválido': [],
        'Já possui empréstimo ativo (Outra Pessoa)': [],
        'Já importado (Mesma Pessoa)': [],
        'Erro na leitura do documento': [],
        'Outros erros': []
      }
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setImportProgress(Math.round(((i) / files.length) * 100));
      let sn = '?';
      let nifFinal = '?';
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value;

        // Extrair S/N (ex: CND5041MWY)
        const snMatch = text.match(/N\.º de série do computador n\.º\s+([A-Z0-9]+)/i) || 
                        text.match(/N\.º de série\s+([A-Z0-9]+)/i) ||
                        text.match(/S\/N:?\s+([A-Z0-9]+)/i);
        
        // Extrair NIF do aluno (9 dígitos)
        const nifMatches = Array.from(text.matchAll(/\b\d{9}\b/g)).map(m => m[0]);
        const alunoNifMatch = text.match(/aluno[\s\S]+?com\s+o\s+NIF\s+(\d{9})/i);
        nifFinal = alunoNifMatch ? alunoNifMatch[1] : (nifMatches.length >= 2 ? nifMatches[1] : nifMatches[0]);

        sn = snMatch ? snMatch[1].trim() : null;

        if (!sn || !nifFinal) {
          results.erro['Erro na leitura do documento'].push({ file: file.name, detail: `SN=${sn || '?'}, NIF=${nifFinal || '?'}` });
          results.falhas.push({ file, sn: sn || '?', nif: nifFinal || '?' });
          continue;
        }

        // 1. Procurar Pessoa primeiro
        const { data: ps } = await db.client
          .from('pessoas')
          .select('*')
          .eq('nif', nifFinal);

        if (!ps || ps.length === 0) {
          results.erro['Pessoa não encontrada'].push({ file: file.name, detail: nifFinal });
          results.falhas.push({ file, sn, nif: nifFinal });
          continue;
        }
        const pessoa = ps[0];

        // 2. Procurar Equipamento
        const { data: eqs } = await db.client
          .from('equipamentos')
          .select('*')
          .eq('numero_serie', sn);

        let eq = eqs?.[0];
        let isSimilar = false;

        if (!eq) {
          // Busca aproximada (typo ou troca de letras)
          // Aumentado para distância 2 (dois caracteres errados)
          eq = (equipamentosTodos || []).find(e => 
            damerauLevenshtein(e.numero_serie, sn) <= 2
          );
          if (eq) isSimilar = true;
        }

        if (!eq) {
          results.erro['Equipamento não encontrado'].push({ file: file.name, detail: sn });
          results.falhas.push({ file, sn, nif: nifFinal });
          continue;
        }

        // Validar Estado do Equipamento (Pode ser o exato ou o similar encontrado)
        const estadosPermitidos = ['Escola', 'Recondicionamento', 'Rececionado'];
        
        if (eq.estado === 'Aluno' || eq.estado === 'Docente') {
          // Verificar se o empréstimo ativo é para esta pessoa
          const { data: empAtivo } = await db.client
            .from('emprestimos')
            .select('*')
            .eq('equipamento_id', eq.id)
            .eq('estado', 'ATIVO')
            .maybeSingle();

          if (empAtivo && empAtivo.pessoa_id === pessoa.id) {
            // JÁ IMPORTADO (Mesmo que tenha sido por sugestão anteriormente)
            const temAuto = empAtivo.documentos_entrega?.some(d => d.nome.startsWith('Auto_Entrega_'));
            if (!temAuto) {
              try {
                const { file_url } = await db.integrations.Core.UploadFile({ 
                  file, 
                  folder: 'autos' 
                });
                const novoDoc = { 
                  nome: `Auto_Entrega_${eq.numero_serie}_${pessoa.nome.replace(/\s+/g, '_')}.docx`, 
                  url: file_url, 
                  ativo: true 
                };
                await db.entities.Emprestimo.update(empAtivo.id, {
                  documentos_entrega: [...(empAtivo.documentos_entrega || []), novoDoc]
                });
              } catch (upErr) {
                console.error('Erro no auto-upload para empréstimo existente:', upErr);
              }
            }
            results.erro['Já importado (Mesma Pessoa)'].push({ 
              file: file.name, 
              detail: `${isSimilar ? '(S/N Aproximado) ' : ''}${eq.numero_serie} -> ${pessoa.nome}` 
            });
            continue;
          } else {
            results.erro['Já possui empréstimo ativo (Outra Pessoa)'].push({ file: file.name, detail: `${eq.numero_serie} (Ativo com outro utilizador)` });
            results.falhas.push({ file, sn, nif: nifFinal });
            continue;
          }
        }

        // Se chegámos aqui e é similar, então é uma sugestão de novo empréstimo
        if (isSimilar) {
          results.sugestoes.push({ 
            file: file.name, 
            fileBlob: file,
            snOriginal: sn, 
            snSugerido: eq.numero_serie,
            eq: eq,
            pessoa: pessoa
          });
          continue;
        }

        if (!estadosPermitidos.includes(eq.estado)) {
          results.erro['Estado inválido'].push({ file: file.name, detail: `${sn} (${eq.estado})` });
          results.falhas.push({ file, sn, nif: nifFinal });
          continue;
        }

        // 3. Criar Empréstimo
        const eqNome = `${eq.tipo} ${eq.marca} ${eq.modelo}`.trim() || eq.designacao;
        
        // Fazer Upload do ficheiro primeiro
        let documentos_entrega = [];
        try {
          const { file_url } = await db.integrations.Core.UploadFile({ 
            file, 
            folder: 'autos' 
          });
          documentos_entrega.push({ 
            nome: `Auto_Entrega_${sn}_${pessoa.nome.replace(/\s+/g, '_')}.docx`, 
            url: file_url, 
            ativo: true 
          });
        } catch (upErr) {
          console.error('Erro no auto-upload:', upErr);
        }

        const novoEmp = {
          equipamento_id: eq.id,
          pessoa_id: pessoa.id,
          equipamento_info: eqNome,
          pessoa_info: pessoa.nome,
          data_emprestimo: new Date().toISOString().split('T')[0],
          estado: 'ATIVO',
          notas_entrega: 'Auto provisório',
          acessorios_entregues: { 'Mochila': true, 'Transformador': true },
          autorizacao_ee: true,
          ee_levanta: true,
          inserido_sistema: true,
          documentos_entrega
        };

        try {
          await db.entities.Emprestimo.create(novoEmp);
          
          // Atualizar estado do equipamento
          const novoEstado = pessoa.tipo === 'Aluno' ? 'Aluno' : 'Docente';
          await db.entities.Equipamento.update(eq.id, { estado: novoEstado });
          
          results.sucesso.push({ file: file.name, detail: `${sn} -> ${pessoa.nome}` });
        } catch (dbErr) {
          results.erro['Outros erros'].push({ file: file.name, detail: dbErr.message });
          results.falhas.push({ file, sn, nif: nifFinal });
        }
      } catch (err) {
        console.error(`Erro ao importar ${file.name}:`, err);
        results.erro['Outros erros'].push({ file: file.name, detail: err.message });
        results.falhas.push({ file, sn, nif: nifFinal });
      }
    }

    setImportProgress(100);
    qc.invalidateQueries({ queryKey: ['emprestimos'] });
    qc.invalidateQueries({ queryKey: ['equipamentos'] });
    
    setImportSummary(results);
    setSummaryOpen(true);
    setImporting(false);
    setImportProgress(0);
    toast.success('Processamento concluído', { id: toastId });
    e.target.value = ''; // Reset input
  };

  const handleConfirmSuggestion = async (sug, index) => {
    const toastId = toast.loading('A criar empréstimo sugerido...');
    try {
      const eqNome = `${sug.eq.tipo} ${sug.eq.marca} ${sug.eq.modelo}`.trim() || sug.eq.designacao;
      
      // Fazer Upload do ficheiro para a sugestão também
      let documentos_entrega = [];
      try {
        const { file_url } = await db.integrations.Core.UploadFile({ 
          file: sug.fileBlob, 
          folder: 'autos' 
        });
        documentos_entrega.push({ 
          nome: `Auto_Entrega_${sug.snSugerido}_${sug.pessoa.nome.replace(/\s+/g, '_')}.docx`, 
          url: file_url, 
          ativo: true 
        });
      } catch (upErr) {
        console.error('Erro no auto-upload da sugestão:', upErr);
      }

      const novoEmp = {
        equipamento_id: sug.eq.id,
        pessoa_id: sug.pessoa.id,
        equipamento_info: eqNome,
        pessoa_info: sug.pessoa.nome,
        data_emprestimo: new Date().toISOString().split('T')[0],
        estado: 'ATIVO',
        notas_entrega: `Auto provisório (S/N corrigido na importação: ${sug.snOriginal} -> ${sug.snSugerido})`,
        acessorios_entregues: { 'Mochila': true, 'Transformador': true },
        autorizacao_ee: true,
        ee_levanta: true,
        inserido_sistema: true,
        documentos_entrega
      };

      await db.entities.Emprestimo.create(novoEmp);
      const novoEstado = sug.pessoa.tipo === 'Aluno' ? 'Aluno' : 'Docente';
      await db.entities.Equipamento.update(sug.eq.id, { estado: novoEstado });

      setImportSummary(prev => {
        const newSugestoes = [...prev.sugestoes];
        newSugestoes.splice(index, 1);
        return {
          ...prev,
          sucesso: [...prev.sucesso, { file: sug.file, detail: `${sug.snSugerido} -> ${sug.pessoa.nome} (Corrigido)` }],
          sugestoes: newSugestoes
        };
      });

      qc.invalidateQueries({ queryKey: ['emprestimos'] });
      qc.invalidateQueries({ queryKey: ['equipamentos'] });
      toast.success('Empréstimo criado com sucesso', { id: toastId });
    } catch (err) {
      toast.error('Erro ao confirmar sugestão: ' + err.message, { id: toastId });
    }
  };

  const downloadFailedZip = async () => {
    if (!importSummary?.falhas?.length) return;
    
    const zip = new JSZip();
    importSummary.falhas.forEach(item => {
      const prefix = `${item.sn}_${item.nif}_`;
      zip.file(prefix + item.file.name, item.file);
    });
    
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `Autos_Nao_Importados_${format(new Date(), 'yyyyMMdd_HHmm')}.zip`);
    toast.success('ZIP gerado com sucesso');
  };

  const handlePDF = (emp, e) => {
    if (e) e.stopPropagation();
    gerarPDFEmprestimo(emp, pdfTemplates, user);
  };

  const handleEdit = (emp) => {
    setEditForm({
      id: emp.id,
      acessorios_entregues: emp.acessorios_entregues || {},
      autorizacao_ee: emp.autorizacao_ee || false,
      ee_levanta: emp.ee_levanta || false,
      inserido_sistema: emp.inserido_sistema || false,
      notas_entrega: emp.notas_entrega || '',
      documentos_entrega: emp.documentos_entrega || [],
      // Campos de devolução
      devolucao_id: emp.devolucao_id,
      acessorios_devolvidos: emp.acessorios_devolvidos || {},
      notas_devolucao: emp.notas_devolucao || emp.devolucao_notas || '',
      documentos_devolucao: emp.documentos_devolucao || emp.devolucao_documentos || []
    });
    setEditOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Empréstimos" 
        subtitle={
          filtered.length === emprestimos.length
            ? `${emprestimos.filter(e => e.estado === 'ATIVO').length} empréstimo(s) ativo(s)`
            : `${filtered.length} de ${emprestimos.length} empréstimo(s) (filtrado)`
        } 
        action={() => setFormOpen(true)} 
        actionLabel="Novo Empréstimo" 
      >
        <div className="flex gap-2">
          <input
            type="file"
            id="import-auto"
            className="hidden"
            accept=".docx"
            multiple
            onChange={handleImportAuto}
            disabled={importing}
          />
          <Button 
            variant="outline" 
            onClick={() => document.getElementById('import-auto').click()}
            disabled={importing}
          >
            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Importar Auto
          </Button>
          <Button variant="outline" onClick={() => navigate('/notificacoes-devolucao')}>
            <Mail className="w-4 h-4 mr-2" />
            Notificações
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Pesquisar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <SmartScanner onResult={v => setSearchTerm(v)} label="Pesquisar por scanner" />
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ATIVO">Ativos</SelectItem>
            <SelectItem value="DEVOLVIDO">Devolvidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead><SortButton column="equipamento_info" currentSort={sort} onSort={handleSort} label="Equipamento" /></TableHead>
              <TableHead><SortButton column="equipamento_sn" currentSort={sort} onSort={handleSort} label="Nº Série" /></TableHead>
              <TableHead><SortButton column="pessoa_info" currentSort={sort} onSort={handleSort} label="Pessoa" /></TableHead>
              <TableHead><SortButton column="pessoa_nif" currentSort={sort} onSort={handleSort} label="NIF" /></TableHead>
              <TableHead className="hidden sm:table-cell"><SortButton column="data_emprestimo" currentSort={sort} onSort={handleSort} label="Data" /></TableHead>
              <TableHead><SortButton column="estado" currentSort={sort} onSort={handleSort} label="Estado" /></TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">A carregar...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum empréstimo encontrado</TableCell></TableRow>
            ) : (
              filtered.map(emp => (
                <TableRow key={emp.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => { setDetailItem(emp); setDetailOpen(true); }}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{emp.equipamentoLabel}</span>
                      {emp.isKitLoan && emp.kitLoanData.count > 1 && (
                        <span className="text-[10px] text-blue-600 font-bold">
                          CONJUNTO (+ {emp.kitLoanData.count - 1} itens)
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{emp.equipamentoSn}</TableCell>
                  <TableCell>{emp.pessoaNome}</TableCell>
                  <TableCell className="text-sm">{emp.pessoaNif}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{format(new Date(emp.data_emprestimo), 'dd/MM/yyyy')}</TableCell>
                  <TableCell><StatusBadge status={emp.estado} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {emp.estado === 'ATIVO' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="Solicitar Devolução" 
                          onClick={e => { e.stopPropagation(); setDetailItem(emp); setRequestReturnOpen(true); }}
                        >
                          <Mail className="w-4 h-4 text-primary" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" title="Exportar Auto (Word)" onClick={e => handlePDF(emp, e)}><FileDown className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* New Loan Dialog */}
      <Dialog open={formOpen} onOpenChange={v => { if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Empréstimo</DialogTitle>
            <DialogDescription>Associa um equipamento a uma pessoa e regista os acessórios entregues.</DialogDescription>
          </DialogHeader>

          {step === 1 && (
            <div className="space-y-5">
              {/* Equipment */}
              <div className="space-y-2">
                <Label className="font-semibold">1. Equipamento</Label>
                {selectedEq ? (
                  <div className="p-3 rounded-lg border bg-emerald-50 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">{selectedEq.designacao}</p>
                      <p className="text-xs text-muted-foreground">SN: {selectedEq.numero_serie}</p>
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
                      {filteredEq.map(eq => (
                        <button key={eq.id} onClick={() => setSelectedEq(eq)} className="w-full text-left p-2 rounded hover:bg-muted text-sm flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="font-medium">{eq.designacao} — {eq.numero_serie}</span>
                            {eq.isKit && eq.kitData.componentTypes && (
                              <span className="text-[10px] text-blue-600 font-bold">
                                KIT (+ {eq.kitData.components.length} itens: {eq.kitData.componentTypes})
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase font-bold">{eq.estado}</span>
                        </button>
                      ))}
                      {eqSearch && filteredEq.length === 0 && (
                        <div className="p-2">
                          <p className="text-sm text-muted-foreground mb-2">Nenhum equipamento disponível encontrado.</p>
                          <Button size="sm" variant="outline" onClick={() => setCreateEq(true)}><Plus className="w-4 h-4 mr-1" />Criar equipamento</Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Person */}
              <div className="space-y-2">
                <Label className="font-semibold">2. Pessoa</Label>
                {selectedPessoa ? (
                  <div className="p-3 rounded-lg border bg-blue-50 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">{selectedPessoa.nome}</p>
                      <p className="text-xs text-muted-foreground">{selectedPessoa.tipo} — {selectedPessoa.turma || selectedPessoa.email}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedPessoa(null)}>Alterar</Button>
                  </div>
                ) : createPessoa ? (
                  <MiniPessoaForm onCreated={p => { setSelectedPessoa(p); setCreatePessoa(false); }} onCancel={() => setCreatePessoa(false)} />
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Input placeholder="Nome, email, telefone, NIF..." value={pessoaSearch} onChange={e => setPessoaSearch(e.target.value)} className="flex-1" />
                      <SmartScanner onResult={v => setPessoaSearch(v)} label="Ler Pessoa" />
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {filteredPessoas.map(p => (
                        <button key={p.id} onClick={() => setSelectedPessoa(p)} className="w-full text-left p-2 rounded hover:bg-muted text-sm flex justify-between items-center">
                          <span>{p.nome} — {p.tipo} {p.turma ? `(${p.turma})` : ''}</span>
                          {!p.ativo && <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded uppercase font-bold">Inativo</span>}
                        </button>
                      ))}
                      {pessoaSearch && filteredPessoas.length === 0 && (
                        <div className="p-2">
                          <p className="text-sm text-muted-foreground mb-2">Nenhuma pessoa encontrada.</p>
                          <Button size="sm" variant="outline" onClick={() => setCreatePessoa(true)}><Plus className="w-4 h-4 mr-1" />Criar pessoa</Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <AcessoriosCheck value={acessorios} onChange={setAcessorios} title="Acessórios entregues" />

              <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
                <div className="flex items-center space-x-2">
                  <Checkbox id="autorizacao_ee" checked={autorizacaoEE} onCheckedChange={setAutorizacaoEE} />
                  <Label htmlFor="autorizacao_ee" className="text-sm font-medium leading-none cursor-pointer">Autorização EE</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="ee_levanta" checked={eeLevanta} onCheckedChange={setEeLevanta} />
                  <Label htmlFor="ee_levanta" className="text-sm font-medium leading-none cursor-pointer">EE Levanta</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="inserido_sistema" checked={inseridoSistema} onCheckedChange={setInseridoSistema} />
                  <Label htmlFor="inserido_sistema" className="text-sm font-medium leading-none cursor-pointer">Inserido Sistema</Label>
                </div>
              </div>

              <div>
                <Label>Notas de Entrega</Label>
                <div className="flex gap-2 items-start">
                  <Textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Estado do equipamento na entrega..." className="flex-1" />
                  <SmartScanner onResult={v => setNotas((notas ? notas + '\n' : '') + v)} label="Ler Notas" mode="ocr_only" />
                </div>
              </div>
              <FileUpload files={docs} onChange={setDocs} label="Fotos/Documentos de Entrega" />

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={resetForm}>Cancelar</Button>
                <Button onClick={() => setStep(2)} disabled={!selectedEq || !selectedPessoa}>Continuar</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <h3 className="font-semibold text-sm">Resumo do Empréstimo</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Equipamento</p><p className="font-medium">{selectedEq?.designacao}</p></div>
                  <div><p className="text-xs text-muted-foreground">Nº Série</p><p className="font-medium">{selectedEq?.numero_serie}</p></div>
                  <div><p className="text-xs text-muted-foreground">Pessoa</p><p className="font-medium">{selectedPessoa?.nome}</p></div>
                </div>
                {Object.values(acessorios).some(Boolean) && (
                  <div>
                    <p className="text-xs text-muted-foreground">Acessórios</p>
                    <p className="text-sm">{Object.entries(acessorios).filter(([,v]) => v).map(([k]) => k).join(', ')}</p>
                  </div>
                )}
                {notas && <div><p className="text-xs text-muted-foreground">Notas</p><p className="text-sm">{notas}</p></div>}
              </div>
              <p className="text-xs text-muted-foreground">O Auto será gerado automaticamente após confirmar.</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'A registar...' : 'Confirmar Empréstimo'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Request Return Dialog */}
      <Dialog open={requestReturnOpen} onOpenChange={setRequestReturnOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Solicitar Devolução
            </DialogTitle>
            <DialogDescription>Informa o utilizador de que deve proceder à devolução do equipamento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <p><strong>Equipamento:</strong> {detailItem?.equipamento_info}</p>
              <p><strong>Pessoa:</strong> {detailItem?.pessoa_info}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Motivo (Opcional)</Label>
              <RichTextEditor
                value={returnReason || ''}
                onChange={(content) => setReturnReason(content)}
                showDocxTools={false}
                showHelp={false}
                height={220}
                menubar={false}
                toolbar="undo redo | blocks | bold italic underline | forecolor backcolor | alignleft aligncenter alignright | bullist numlist | link | removeformat"
                plugins={['lists', 'link', 'autolink', 'code']}
                placeholder="Ex: Fim do ano letivo, atualização de software..."
              />
            </div>
            <p className="text-[10px] text-muted-foreground italic">
              Será enviado um email automático solicitando a devolução do equipamento.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestReturnOpen(false)}>Cancelar</Button>
            <Button 
              onClick={() => requestReturnMutation.mutate({ emp: detailItem, motivo: returnReason })}
              disabled={requestReturnMutation.isPending}
            >
              {requestReturnMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> A enviar...</> : 'Enviar Pedido'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {detailItem && (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhe do Empréstimo</DialogTitle>
            <DialogDescription>Consulta as informações de entrega, acessórios e documentos associados.</DialogDescription>
          </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2"><StatusBadge status={detailItem.estado} /></div>
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg text-sm">
                <div><p className="text-xs text-muted-foreground">Equipamento</p><p className="font-medium">{detailItem.equipamento_info}</p></div>
                <div><p className="text-xs text-muted-foreground">Pessoa</p><p className="font-medium">{detailItem.pessoa_info}</p></div>
                <div><p className="text-xs text-muted-foreground">Data Empréstimo</p><p>{format(new Date(detailItem.data_emprestimo), 'dd/MM/yyyy')}</p></div>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div className={`p-2 rounded border text-center ${detailItem.autorizacao_ee ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-muted/30 text-muted-foreground'}`}>
                  <p className="text-[10px] uppercase font-bold">Autoriz. EE</p>
                  <p className="text-xs font-medium">{detailItem.autorizacao_ee ? 'Sim' : 'Não'}</p>
                </div>
                <div className={`p-2 rounded border text-center ${detailItem.ee_levanta ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-muted/30 text-muted-foreground'}`}>
                  <p className="text-[10px] uppercase font-bold">EE Levanta</p>
                  <p className="text-xs font-medium">{detailItem.ee_levanta ? 'Sim' : 'Não'}</p>
                </div>
                <div className={`p-2 rounded border text-center ${detailItem.inserido_sistema ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-muted/30 text-muted-foreground'}`}>
                  <p className="text-[10px] uppercase font-bold">No Sistema</p>
                  <p className="text-xs font-medium">{detailItem.inserido_sistema ? 'Sim' : 'Não'}</p>
                </div>
              </div>

              <Tabs defaultValue="geral">
                <TabsList className="w-full">
                  <TabsTrigger value="geral" className="flex-1">Geral</TabsTrigger>
                  {detailItem.isKitLoan && detailItem.kitLoanData.count > 1 && (
                    <TabsTrigger value="kit" className="flex-1">Conjunto ({detailItem.kitLoanData.count})</TabsTrigger>
                  )}
                  <TabsTrigger value="docs" className="flex-1">Documentos</TabsTrigger>
                </TabsList>

                <TabsContent value="geral" className="space-y-4 pt-3">
                  {detailItem.notas_entrega && <div><p className="text-xs text-muted-foreground font-semibold">Notas de Entrega</p><p className="text-sm mt-1 p-2 bg-muted/30 rounded">{detailItem.notas_entrega}</p></div>}
                  {detailItem.acessorios_entregues && Object.values(detailItem.acessorios_entregues).some(Boolean) && (
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Acessórios Entregues</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(detailItem.acessorios_entregues).filter(([,v]) => v).map(([k]) => (
                          <span key={k} className="text-xs bg-blue-100 text-blue-700 rounded px-2 py-0.5">{k}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {detailItem.notas_devolucao && <div><p className="text-xs text-muted-foreground font-semibold">Notas de Devolução</p><p className="text-sm mt-1 p-2 bg-muted/30 rounded">{detailItem.notas_devolucao}</p></div>}
                </TabsContent>

                <TabsContent value="kit" className="pt-3 space-y-2">
                  <div className="p-3 rounded-lg border border-blue-100 bg-blue-50/20 text-xs flex justify-between items-center">
                    <div>
                      <p className="font-bold">{detailItem.equipamentoLabel}</p>
                      <p className="text-muted-foreground font-mono">S/N: {detailItem.equipamentoSn}</p>
                    </div>
                    <Badge className="bg-blue-600">PRINCIPAL</Badge>
                  </div>
                  {detailItem.kitLoanData?.siblings?.map(sibling => (
                    <div key={sibling.id} className="p-3 rounded-lg border text-xs flex justify-between items-center">
                      <div>
                        <p className="font-medium">{sibling.equipamentoLabel}</p>
                        <p className="text-muted-foreground font-mono">S/N: {sibling.equipamentoSn}</p>
                      </div>
                      <StatusBadge status={sibling.estado} className="scale-75 origin-right" />
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="docs" className="pt-3">
                  {detailItem.documentos_entrega?.filter(d => d.ativo !== false).length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {detailItem.documentos_entrega.filter(d => d.ativo !== false).map((doc, i) => (
                        <div 
                          key={i} 
                          onClick={() => setSelectedDoc(doc)}
                          className="p-2 rounded border hover:bg-muted/50 text-center text-xs cursor-pointer truncate"
                        >
                          {doc.nome}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Sem documentos de entrega.</p>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => handleEdit(detailItem)}>
                  Editar Detalhes
                </Button>
                <Button variant="outline" size="sm" onClick={() => { gerarPDFEmprestimo(detailItem, pdfTemplates, user, 'docx'); }}>
                  <FileDown className="w-4 h-4 mr-1" />Exportar Auto (Word)
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Document Viewer */}
      <DocumentViewer 
        open={!!selectedDoc} 
        onClose={() => setSelectedDoc(null)} 
        document={selectedDoc} 
      />

      {/* Edit Dialog */}
      <Dialog open={editMode} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Empréstimo / Devolução</DialogTitle>
            <DialogDescription>Atualize os acessórios, notas e documentos do registo.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase text-primary border-b pb-1">Dados de Entrega</h3>
              
              <AcessoriosCheck 
                value={editForm.acessorios_entregues} 
                onChange={(v) => setEditForm({...editForm, acessorios_entregues: v})} 
                title="Acessórios entregues" 
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 border rounded-lg bg-muted/20">
                <div className="flex items-center space-x-2">
                  <Checkbox id="edit_auth" checked={editForm.autorizacao_ee} onCheckedChange={(v) => setEditForm({...editForm, autorizacao_ee: !!v})} />
                  <Label htmlFor="edit_auth" className="text-xs cursor-pointer">Autoriz. EE</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="edit_lev" checked={editForm.ee_levanta} onCheckedChange={(v) => setEditForm({...editForm, ee_levanta: !!v})} />
                  <Label htmlFor="edit_lev" className="text-xs cursor-pointer">EE Levanta</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="edit_sys" checked={editForm.inserido_sistema} onCheckedChange={(v) => setEditForm({...editForm, inserido_sistema: !!v})} />
                  <Label htmlFor="edit_sys" className="text-xs cursor-pointer">No Sistema</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Notas de Entrega</Label>
                <Textarea 
                  value={editForm.notas_entrega} 
                  onChange={e => setEditForm({...editForm, notas_entrega: e.target.value})}
                  className="min-h-[80px]"
                />
              </div>

              <FileUpload 
                files={editForm.documentos_entrega} 
                onChange={v => setEditForm({...editForm, documentos_entrega: v})} 
                label="Fotos/Documentos de Entrega" 
              />
            </div>

            {detailItem?.estado === 'DEVOLVIDO' && (
              <div className="space-y-4 pt-4 border-t-2">
                <h3 className="text-sm font-bold uppercase text-amber-600 border-b pb-1">Dados de Devolução</h3>
                
                <AcessoriosCheck 
                  value={editForm.acessorios_devolvidos} 
                  onChange={(v) => setEditForm({...editForm, acessorios_devolvidos: v})} 
                  title="Acessórios devolvidos" 
                />

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Notas de Devolução</Label>
                  <Textarea 
                    value={editForm.notas_devolucao} 
                    onChange={e => setEditForm({...editForm, notas_devolucao: e.target.value})}
                    className="min-h-[80px]"
                  />
                </div>

                <FileUpload 
                  files={editForm.documentos_devolucao} 
                  onChange={v => setEditForm({...editForm, documentos_devolucao: v})} 
                  label="Fotos/Documentos de Devolução" 
                />
              </div>
            )}
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

      {/* Import Progress Dialog */}
      <Dialog open={importing} onOpenChange={() => {}}>
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              A importar documentos...
            </DialogTitle>
            <DialogDescription>Por favor, não feche esta janela enquanto o processamento decorre.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Progress value={importProgress} className="h-2" />
            <p className="text-center text-sm font-medium text-muted-foreground">
              {importProgress}% concluído
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Summary Dialog */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resumo da Importação</DialogTitle>
            <DialogDescription>
              Processados {importSummary?.sucesso.length + Object.values(importSummary?.erro || {}).flat().length} ficheiros.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* 1. Equipamento não encontrado */}
            {importSummary?.erro?.['Equipamento não encontrado']?.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-destructive flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive" />
                  Equipamento não encontrado ({importSummary.erro['Equipamento não encontrado'].length})
                </h3>
                <div className="grid grid-cols-1 gap-1 pl-4 border-l-2 border-destructive/20">
                  {importSummary.erro['Equipamento não encontrado'].map((item, i) => (
                    <div key={i} className="text-xs flex justify-between gap-4">
                      <span className="font-medium truncate max-w-[200px]" title={item.file}>{item.file}</span>
                      <span className="text-muted-foreground italic truncate flex-1 text-right">{item.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Erro na leitura do documento */}
            {importSummary?.erro?.['Erro na leitura do documento']?.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-destructive flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive" />
                  Erro na leitura do documento ({importSummary.erro['Erro na leitura do documento'].length})
                </h3>
                <div className="grid grid-cols-1 gap-1 pl-4 border-l-2 border-destructive/20">
                  {importSummary.erro['Erro na leitura do documento'].map((item, i) => (
                    <div key={i} className="text-xs flex justify-between gap-4">
                      <span className="font-medium truncate max-w-[200px]" title={item.file}>{item.file}</span>
                      <span className="text-muted-foreground italic truncate flex-1 text-right">{item.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sugestões de Correção de S/N */}
            {importSummary?.sugestoes?.length > 0 && (
              <div className="space-y-3 bg-amber-50/50 p-4 rounded-lg border border-amber-200">
                <h3 className="text-sm font-bold text-amber-700 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Sugestões de S/N ({importSummary.sugestoes.length})
                </h3>
                <div className="space-y-2 pl-4">
                  {importSummary.sugestoes.map((sug, i) => (
                    <div key={i} className="text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-white rounded border border-amber-100 shadow-sm">
                      <div className="flex-1">
                        <p className="font-bold truncate max-w-[250px] text-muted-foreground" title={sug.file}>{sug.file}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-mono text-[10px]">{sug.snOriginal}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono font-bold text-[10px]">{sug.snSugerido}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Pessoa: {sug.pessoa.nome}</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="default" 
                        className="h-8 bg-amber-600 hover:bg-amber-700 text-white shadow-none" 
                        onClick={() => handleConfirmSuggestion(sug, i)}
                      >
                        Corrigir e Criar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Sucesso */}
            {importSummary?.sucesso.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-emerald-600 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-600" />
                  Sucesso ({importSummary.sucesso.length})
                </h3>
                <div className="grid grid-cols-1 gap-1 pl-4 border-l-2 border-emerald-100">
                  {importSummary.sucesso.map((item, i) => (
                    <div key={i} className="text-xs flex justify-between gap-4">
                      <span className="font-medium truncate max-w-[200px]" title={item.file}>{item.file}</span>
                      <span className="text-muted-foreground italic truncate flex-1 text-right">{item.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Outros Erros (Restantes) */}
            {Object.entries(importSummary?.erro || {}).map(([reason, items]) => {
              if (['Equipamento não encontrado', 'Erro na leitura do documento', 'Já importado (Mesma Pessoa)'].includes(reason)) return null;
              if (items.length === 0) return null;
              return (
                <div key={reason} className="space-y-2">
                  <h3 className="text-sm font-bold text-destructive flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-destructive" />
                    {reason} ({items.length})
                  </h3>
                  <div className="grid grid-cols-1 gap-1 pl-4 border-l-2 border-destructive/20">
                    {items.map((item, i) => (
                      <div key={i} className="text-xs flex justify-between gap-4">
                        <span className="font-medium truncate max-w-[200px]" title={item.file}>{item.file}</span>
                        <span className="text-muted-foreground italic truncate flex-1 text-right">{item.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* 4. Já importado (Mesma Pessoa) - No fim e a Verde */}
            {importSummary?.erro?.['Já importado (Mesma Pessoa)']?.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-emerald-600 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-600" />
                  Já importado (Mesma Pessoa) ({importSummary.erro['Já importado (Mesma Pessoa)'].length})
                </h3>
                <div className="grid grid-cols-1 gap-1 pl-4 border-l-2 border-emerald-100">
                  {importSummary.erro['Já importado (Mesma Pessoa)'].map((item, i) => (
                    <div key={i} className="text-xs flex justify-between gap-4">
                      <span className="font-medium truncate max-w-[200px]" title={item.file}>{item.file}</span>
                      <span className="text-muted-foreground italic truncate flex-1 text-right">{item.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importSummary?.sucesso.length === 0 && Object.values(importSummary?.erro || {}).flat().length === 0 && (
              <p className="text-center py-8 text-muted-foreground">Nenhum ficheiro processado.</p>
            )}
          </div>

          <DialogFooter className="flex justify-between items-center sm:justify-between gap-2">
            <div className="flex gap-2">
              {importSummary?.falhas?.length > 0 && (
                <Button variant="outline" onClick={downloadFailedZip} className="text-destructive border-destructive hover:bg-destructive/10">
                  <Download className="w-4 h-4 mr-2" />
                  Falhas (ZIP)
                </Button>
              )}
              {importSummary && (
                <Button variant="outline" onClick={() => gerarRelatorioImportacaoPDF(importSummary)} className="text-primary border-primary hover:bg-primary/10">
                  <Download className="w-4 h-4 mr-2" />
                  Relatório de Importação
                </Button>
              )}
            </div>
            <Button onClick={() => setSummaryOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
