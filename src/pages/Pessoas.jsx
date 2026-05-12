import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { EmailService } from '@/api/emailService';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Pencil, Plus, FileSpreadsheet, Mail, Loader2, Clock, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';

// Componente de Verificação de Pessoas Ativas
import SmartScanner from '@/components/shared/SmartScanner';
import RichTextEditor from '@/components/shared/RichTextEditor';
import FileUpload from '@/components/shared/FileUpload';
import ImportDialog from '@/components/shared/ImportDialog';
import PessoaDetail from '@/components/pessoas/PessoaDetail';
import { toast } from 'sonner';

function ActiveVerificationDialog({ open, onClose, currentPeople }) {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [pendingPeople, setPendingPeople] = useState([]);
  const [readPeople, setReadPeople] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Ao abrir, inicializamos a lista de pendentes com todas as pessoas da DB
  useEffect(() => {
    if (open) {
      setPendingPeople([...currentPeople]);
      setReadPeople([]);
    }
  }, [open, currentPeople]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        // Identificar NIFs no ficheiro (procurar colunas comuns)
        const fileNifs = new Set();
        rows.forEach(row => {
          // Procurar por chaves que contenham "nif" ou "contribuinte"
          const nifKey = Object.keys(row).find(k => 
            k.toLowerCase().includes('nif') || 
            k.toLowerCase().includes('contribuinte') ||
            k.toLowerCase().includes('identificação fiscal')
          );
          if (nifKey && row[nifKey]) {
            fileNifs.add(String(row[nifKey]).trim());
          }
        });

        // Filtrar pendentes: remover quem está no ficheiro
        const remaining = pendingPeople.filter(p => !fileNifs.has(String(p.nif).trim()));
        const found = pendingPeople.filter(p => fileNifs.has(String(p.nif).trim()));

        setPendingPeople(remaining);
        setReadPeople(prev => [...prev, ...found]);
        toast.success(`Lidas ${found.length} pessoas do ficheiro. Restam ${remaining.length} pendentes.`);
      } catch (err) {
        toast.error("Erro ao ler ficheiro: " + err.message);
      } finally {
        setIsProcessing(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmUpdate = async () => {
    setIsProcessing(true);
    try {
      // Pessoas que sobraram na lista de pendentes -> ativo = false
      // Pessoas que foram lidas (estavam no ficheiro) -> ativo = true
      const updates = [
        ...pendingPeople.map(p => ({ id: p.id, ativo: false })),
        ...readPeople.map(p => ({ id: p.id, ativo: true }))
      ];

      // Executar em chunks para não sobrecarregar
      const chunkSize = 50;
      for (let i = 0; i < updates.length; i += chunkSize) {
        const chunk = updates.slice(i, i + chunkSize);
        await Promise.all(chunk.map(u => db.entities.Pessoa.update(u.id, { ativo: u.ativo })));
      }

      toast.success("Estado de atividade atualizado com sucesso!");
      qc.invalidateQueries({ queryKey: ['pessoas'] });
      onClose();
    } catch (err) {
      toast.error("Erro ao atualizar: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Verificação de Pessoas Ativas</DialogTitle>
          <DialogDescription>
            Carregue ficheiros de alunos/docentes. As pessoas encontradas nos ficheiros serão mantidas como **Ativas**. 
            As que sobrarem na lista no final serão marcadas como **Inativas**.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-lg py-1">
                {pendingPeople.length} Pendentes
              </Badge>
              <Badge variant="secondary" className="text-lg py-1">
                {readPeople.length} Encontradas
              </Badge>
            </div>
            <div className="flex gap-2">
              <input 
                type="file" 
                ref={fileRef} 
                onChange={handleFile} 
                accept=".xlsx,.xls" 
                className="hidden" 
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={isProcessing}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Ler Ficheiro
              </Button>
            </div>
          </div>

          <div className="flex-1 border rounded-md overflow-auto bg-muted/20">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>NIF</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Turma</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingPeople.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Lista vazia. Todas as pessoas foram encontradas ou não há registos.
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingPeople.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{p.nif}</TableCell>
                      <TableCell>{p.tipo}</TableCell>
                      <TableCell>{p.turma || '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>Cancelar</Button>
          <Button onClick={confirmUpdate} disabled={isProcessing || (pendingPeople.length === 0 && readPeople.length === 0)}>
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Confirmar e Atualizar Estados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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

export default function Pessoas() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [sort, setSort] = useState({ column: 'created_at', ascending: false });
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [fotoFiles, setFotoFiles] = useState([]);
  
  const [emailForm, setEmailForm] = useState({ assunto: '', corpo: '' });

  const { data: pessoas = [], isLoading } = useQuery({
    queryKey: ['pessoas', sort],
    queryFn: () => db.entities.Pessoa.list(`${sort.ascending ? '' : '-'}${sort.column}`)
  });

  const { data: configHorario = { dados: { texto: '' } } } = useQuery({
    queryKey: ['config-horario'],
    queryFn: () => db.entities.Configuracao.get('horario').catch(() => ({ dados: { texto: '' } }))
  });

  const saveMutation = useMutation({
    mutationFn: (data) => selected?.id
      ? db.entities.Pessoa.update(selected.id, data)
      : db.entities.Pessoa.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pessoas'] });
      setFormOpen(false);
      toast.success(selected?.id ? 'Pessoa atualizada' : 'Pessoa criada');
    }
  });

  const sendEmailMutation = useMutation({
    mutationFn: async ({ to, cc, subject, body, pessoa_id }) => {
      return EmailService.send({ to, cc, subject, body, pessoa_id, tipo: 'AVULSO' });
    },
    onSuccess: () => {
      setEmailDialogOpen(false);
      toast.success('Email enviado com sucesso!');
    },
    onError: (err) => {
      toast.error('Erro ao enviar email: ' + err.message);
    }
  });

  const openForm = (p = null) => {
    setSelected(p);
    setForm(p || { tipo: 'Aluno', ativo: true });
    setFotoFiles(p?.foto ? [{ url: p.foto, nome: 'foto', tipo: 'image/jpeg' }] : []);
    setFormOpen(true);
  };

  const openEmailDialog = (p, e) => {
    e.stopPropagation();
    if (!p.email) {
      toast.error('Esta pessoa não tem email registado.');
      return;
    }
    setSelected(p);
    setEmailForm({
      assunto: 'Mensagem do KIT Informático',
      corpo: `<p>Olá <strong>${p.nome}</strong>,</p><p>[Escreve aqui a tua mensagem...]</p><p>Atenciosamente,</p>`
    });
    setEmailDialogOpen(true);
  };

  const handleSave = () => {
    const foto = fotoFiles.length > 0 ? fotoFiles[0].url : '';
    saveMutation.mutate({ ...form, foto });
  };

  const handleSort = (column) => {
    setSort(prev => ({
      column,
      ascending: prev.column === column ? !prev.ascending : true
    }));
  };

  const filtered = (pessoas || [])
    .filter(p => {
      const searchTerms = search.toLowerCase().split(/\s+/).filter(Boolean);
      const searchableText = [
        p.nome,
        p.email,
        p.email_pessoal,
        p.n_processo,
        p.turma,
        p.nif,
        p.telefone,
        p.ee_nome
      ].join(' ').toLowerCase();

      const matchSearch = searchTerms.length === 0 || searchTerms.every(term => searchableText.includes(term));
      const matchTipo = filtroTipo === 'todos' || p.tipo === filtroTipo;
      return matchSearch && matchTipo;
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pessoas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length === (pessoas?.length || 0)
              ? `${pessoas?.length || 0} pessoa(s) registada(s)`
              : `${filtered.length} de ${pessoas?.length || 0} pessoa(s) (filtrado)`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setVerifyOpen(true)}>
            <CheckCircle2 className="w-4 h-4 mr-2" />Verificar Ativas
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />Importar
          </Button>
          <Button onClick={() => openForm()} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />Nova Pessoa
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Nome, email, telefone, NIF..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <SmartScanner onResult={v => setSearch(v)} label="Pesquisar por scanner" />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="Aluno">Alunos</SelectItem>
            <SelectItem value="Docente">Docentes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead><SortButton column="nome" currentSort={sort} onSort={handleSort} label="Nome" /></TableHead>
              <TableHead className="hidden sm:table-cell"><SortButton column="email" currentSort={sort} onSort={handleSort} label="Email" /></TableHead>
              <TableHead><SortButton column="nif" currentSort={sort} onSort={handleSort} label="NIF" /></TableHead>
              <TableHead><SortButton column="tipo" currentSort={sort} onSort={handleSort} label="Tipo" /></TableHead>
              <TableHead className="hidden md:table-cell"><SortButton column="turma" currentSort={sort} onSort={handleSort} label="Turma" /></TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">A carregar...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma pessoa encontrada</TableCell></TableRow>
            ) : (
              filtered.map(p => (
                <TableRow key={p.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => { setSelected(p); setDetailOpen(true); }}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {p.foto ? (
                        <img src={p.foto} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${p.ativo ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{p.nome?.[0]}</div>
                      )}
                      <div className="flex flex-col">
                        <span className={`font-medium ${!p.ativo ? 'text-muted-foreground line-through' : ''}`}>{p.nome}</span>
                        {!p.ativo && <span className="text-[10px] text-red-500 font-bold uppercase">Inativa</span>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{p.email}</TableCell>
                  <TableCell className="text-sm font-mono">{p.nif || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={p.tipo === 'Aluno' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-violet-50 text-violet-700 border-violet-200'}>
                      {p.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{p.turma || '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Enviar Email" onClick={e => openEmailDialog(p, e)}><Mail className="w-4 h-4 text-primary" /></Button>
                      <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); openForm(p); }}><Pencil className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Enviar Email para {selected?.nome}
            </DialogTitle>
            <DialogDescription>Escreve uma mensagem personalizada para este utilizador.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Assunto</Label>
              <Input value={emailForm.assunto} onChange={e => setEmailForm({...emailForm, assunto: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Corpo do Email</Label>
              <RichTextEditor
                value={emailForm.corpo || ''}
                onChange={(content) => setEmailForm({ ...emailForm, corpo: content })}
                showDocxTools={false}
                showHelp={false}
                height={320}
                menubar={false}
                toolbar="undo redo | blocks | bold italic underline | forecolor backcolor | alignleft aligncenter alignright | bullist numlist | link | removeformat"
                plugins={['lists', 'link', 'autolink', 'code']}
              />
            </div>
            {configHorario.dados.texto && (
              <div className="p-3 bg-muted/30 rounded border text-[10px] text-muted-foreground flex items-start gap-2">
                <Clock className="w-3 h-3 mt-0.5" />
                <span>O horário de atendimento e os contactos da escola serão incluídos no rodapé do email.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={() => {
                const cc = (selected.tipo === 'Aluno' && selected.ee_email) ? selected.ee_email : undefined;
                sendEmailMutation.mutate({ 
                  to: selected.email, 
                  cc,
                  subject: emailForm.assunto, 
                  body: emailForm.corpo,
                  pessoa_id: selected.id
                });
              }}
              disabled={sendEmailMutation.isPending || !emailForm.assunto || !emailForm.corpo}
            >
              {sendEmailMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> A enviar...</> : 'Enviar Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.id ? 'Editar Pessoa' : 'Nova Pessoa'}</DialogTitle>
            <DialogDescription>Preenche os dados pessoais e as informações do encarregado de educação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-4 border-b pb-4">
              <h3 className="font-semibold text-sm">Dados do Aluno/Docente</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <Label>Nome *</Label>
                  <div className="flex gap-2">
                    <Input value={form.nome || ''} onChange={e => setForm({...form, nome: e.target.value})} className="flex-1" />
                    <SmartScanner onResult={v => setForm({...form, nome: v})} label="Ler Nome" mode="ocr_only" />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <div className="flex gap-2">
                    <Input type="email" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} className="flex-1" />
                    <SmartScanner onResult={v => setForm({...form, email: v})} label="Ler Email" mode="ocr_only" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <Label>Tipo *</Label>
                  <Select value={form.tipo || 'Aluno'} onValueChange={v => setForm({...form, tipo: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Aluno">Aluno</SelectItem>
                      <SelectItem value="Docente">Docente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estado</Label>
                  <Select value={form.ativo === false ? 'false' : 'true'} onValueChange={v => setForm({...form, ativo: v === 'true'})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Ativa</SelectItem>
                      <SelectItem value="false">Inativa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Turma</Label>
                  <div className="flex gap-2">
                    <Input value={form.turma || ''} onChange={e => setForm({...form, turma: e.target.value})} className="flex-1" />
                    <SmartScanner onResult={v => setForm({...form, turma: v})} label="Ler Turma" mode="ocr_only" />
                  </div>
                </div>
                <div>
                  <Label>Nº Processo</Label>
                  <div className="flex gap-2">
                    <Input value={form.n_processo || ''} onChange={e => setForm({...form, n_processo: e.target.value})} className="flex-1" />
                    <SmartScanner onResult={v => setForm({...form, n_processo: v})} label="Ler Nº Processo" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>NIF</Label>
                  <div className="flex gap-2">
                    <Input value={form.nif || ''} onChange={e => setForm({...form, nif: e.target.value})} className="flex-1" />
                    <SmartScanner onResult={v => setForm({...form, nif: v})} label="Ler NIF" />
                  </div>
                </div>
                <div>
                  <Label>Telefone</Label>
                  <div className="flex gap-2">
                    <Input value={form.telefone || ''} onChange={e => setForm({...form, telefone: e.target.value})} className="flex-1" />
                    <SmartScanner onResult={v => setForm({...form, telefone: v})} label="Ler Telefone" />
                  </div>
                </div>
              </div>
              <div>
                <Label>Morada Completa</Label>
                <div className="flex gap-2">
                  <Input value={form.morada || ''} onChange={e => setForm({...form, morada: e.target.value})} className="flex-1" />
                  <SmartScanner onResult={v => setForm({...form, morada: v})} label="Ler Morada" mode="ocr_only" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Escalão ASE/AF</Label>
                  <Select value={form.escalao || 'Não Beneficia'} onValueChange={v => setForm({...form, escalao: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.º Escalão">1.º Escalão</SelectItem>
                      <SelectItem value="2.º Escalão">2.º Escalão</SelectItem>
                      <SelectItem value="3.º Escalão">3.º Escalão</SelectItem>
                      <SelectItem value="4.º Escalão">4.º Escalão</SelectItem>
                      <SelectItem value="Não Beneficia">Não Beneficia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Email Pessoal</Label>
                  <div className="flex gap-2">
                    <Input type="email" value={form.email_pessoal || ''} onChange={e => setForm({...form, email_pessoal: e.target.value})} className="flex-1" />
                    <SmartScanner onResult={v => setForm({...form, email_pessoal: v})} label="Ler Email Pessoal" mode="ocr_only" />
                  </div>
                </div>
              </div>
            </div>

            {form.tipo === 'Aluno' && (
              <fieldset className="border rounded-lg p-4 space-y-4 bg-blue-50/40 border-blue-100 shadow-sm transition-all">
                <legend className="-ml-1 px-2 text-[11px] uppercase tracking-wider font-bold text-blue-700 bg-white border border-blue-100 rounded-md">
                  Encarregado de Educação (EE)
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <Label className="text-blue-900/70">Nome</Label>
                    <div className="flex gap-2">
                      <Input className="bg-white/80 border-blue-100 focus-visible:ring-blue-200 flex-1" value={form.ee_nome || ''} onChange={e => setForm({...form, ee_nome: e.target.value})} />
                      <SmartScanner onResult={v => setForm({...form, ee_nome: v})} label="Ler Nome EE" mode="ocr_only" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-blue-900/70">NIF</Label>
                    <div className="flex gap-2">
                      <Input className="bg-white/80 border-blue-100 focus-visible:ring-blue-200 flex-1" value={form.ee_nif || ''} onChange={e => setForm({...form, ee_nif: e.target.value})} />
                      <SmartScanner onResult={v => setForm({...form, ee_nif: v})} label="Ler NIF EE" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-blue-900/70">Tipo Doc. Identificação</Label>
                    <div className="flex gap-2">
                      <Input className="bg-white/80 border-blue-100 focus-visible:ring-blue-200 flex-1" placeholder="CC, Passaporte..." value={form.ee_tipo_doc || ''} onChange={e => setForm({...form, ee_tipo_doc: e.target.value})} />
                      <SmartScanner onResult={v => setForm({...form, ee_tipo_doc: v})} label="Ler Tipo Doc EE" mode="ocr_only" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-blue-900/70">Nº Doc. Identificação</Label>
                    <div className="flex gap-2">
                      <Input className="bg-white/80 border-blue-100 focus-visible:ring-blue-200 flex-1" value={form.ee_num_doc || ''} onChange={e => setForm({...form, ee_num_doc: e.target.value})} />
                      <SmartScanner onResult={v => setForm({...form, ee_num_doc: v})} label="Ler Nº Doc EE" />
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-blue-900/70">Morada Completa</Label>
                  <div className="flex gap-2">
                    <Input className="bg-white/80 border-blue-100 focus-visible:ring-blue-200 flex-1" value={form.ee_morada || ''} onChange={e => setForm({...form, ee_morada: e.target.value})} />
                    <SmartScanner onResult={v => setForm({...form, ee_morada: v})} label="Ler Morada EE" mode="ocr_only" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-blue-900/70">Email</Label>
                    <div className="flex gap-2">
                      <Input className="bg-white/80 border-blue-100 focus-visible:ring-blue-200 flex-1" type="email" value={form.ee_email || ''} onChange={e => setForm({...form, ee_email: e.target.value})} />
                      <SmartScanner onResult={v => setForm({...form, ee_email: v})} label="Ler Email EE" mode="ocr_only" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-blue-900/70">Telefone</Label>
                    <div className="flex gap-2">
                      <Input className="bg-white/80 border-blue-100 focus-visible:ring-blue-200 flex-1" value={form.ee_telefone || ''} onChange={e => setForm({...form, ee_telefone: e.target.value})} />
                      <SmartScanner onResult={v => setForm({...form, ee_telefone: v})} label="Ler Telefone EE" />
                    </div>
                  </div>
                </div>
              </fieldset>
            )}
            {form.tipo === 'Docente' && (
              <fieldset className="border rounded-lg p-4 space-y-4 bg-violet-50/40 border-violet-100 shadow-sm transition-all">
                <legend className="-ml-1 px-2 text-[11px] uppercase tracking-wider font-bold text-violet-700 bg-white border border-violet-100 rounded-md">
                  Dados do Docente
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-violet-900/70">Grupo de Recrutamento</Label>
                    <Input className="bg-white/80 border-violet-100 focus-visible:ring-violet-200" value={form.grupo_recrutamento || ''} onChange={e => setForm({...form, grupo_recrutamento: e.target.value})} />
                  </div>
                  <div>
                    <Label className="text-violet-900/70">QE</Label>
                    <Input className="bg-white/80 border-violet-100 focus-visible:ring-violet-200" value={form.qe || ''} onChange={e => setForm({...form, qe: e.target.value})} />
                  </div>
                  <div>
                    <Label className="text-violet-900/70">Nº CC</Label>
                    <Input className="bg-white/80 border-violet-100 focus-visible:ring-violet-200" value={form.cc_numero || ''} onChange={e => setForm({...form, cc_numero: e.target.value})} />
                  </div>
                </div>
              </fieldset>
            )}

            <FileUpload files={fotoFiles} onChange={setFotoFiles} label="Foto de Perfil" />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>{saveMutation.isPending ? 'A guardar...' : 'Guardar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selected && <PessoaDetail open={detailOpen} onClose={() => setDetailOpen(false)} pessoa={selected} />}

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entityName="Pessoa"
        queryKey="pessoas"
        jsonSchema={{
          type: 'object',
          properties: {
            nome: { type: 'string' },
            email: { type: 'string' },
            tipo: { type: 'string', enum: ['Aluno', 'Docente'] },
            turma: { type: 'string' },
            nif: { type: 'string' },
            telefone: { type: 'string' },
            morada: { type: 'string' },
            n_processo: { type: 'string' },
            escalao: { type: 'string' },
            email_pessoal: { type: 'string' },
            ee_nome: { type: 'string' },
            ee_tipo_doc: { type: 'string' },
            ee_num_doc: { type: 'string' },
            ee_morada: { type: 'string' },
            ee_email: { type: 'string' },
            ee_nif: { type: 'string' },
            ee_telefone: { type: 'string' },
            grupo_recrutamento: { type: 'string' },
            qe: { type: 'string' },
            cc_numero: { type: 'string' }
          }
        }}
      />

      <ActiveVerificationDialog
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        currentPeople={pessoas || []}
      />
    </div>
  );
}
