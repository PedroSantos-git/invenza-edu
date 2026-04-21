import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { EmailService } from '@/api/emailService';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Search, Pencil, Plus, FileSpreadsheet, Mail, Loader2, Clock } from 'lucide-react';
import SmartScanner from '@/components/shared/SmartScanner';
import RichTextEditor from '@/components/shared/RichTextEditor';
import FileUpload from '@/components/shared/FileUpload';
import ImportDialog from '@/components/shared/ImportDialog';
import PessoaDetail from '@/components/pessoas/PessoaDetail';
import { toast } from 'sonner';

export default function Pessoas() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [fotoFiles, setFotoFiles] = useState([]);
  
  const [emailForm, setEmailForm] = useState({ assunto: '', corpo: '' });

  const { data: pessoas = [], isLoading } = useQuery({
    queryKey: ['pessoas'],
    queryFn: () => db.entities.Pessoa.list('-created_at')
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
    mutationFn: async ({ to, cc, subject, body }) => {
      return EmailService.send({ to, cc, subject, body });
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

  const filtered = (pessoas || [])
    .filter(p => {
      const matchSearch = !search || [p.nome, p.email, p.n_processo, p.turma].some(f => f?.toLowerCase().includes(search.toLowerCase()));
      const matchTipo = filtroTipo === 'todos' || p.tipo === filtroTipo;
      return matchSearch && matchTipo;
    })
    .sort((a, b) => {
      // Primeiro por data de criação (descendente)
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      if (dateB - dateA !== 0) return dateB - dateA;
      
      // Segundo por nome (ascendente)
      return (a.nome || '').localeCompare(b.nome || '');
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pessoas</h1>
          <p className="text-sm text-muted-foreground mt-1">{pessoas.length} pessoa(s) registada(s)</p>
        </div>
        <div className="flex gap-2">
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
              <TableHead>Nome</TableHead>
              <TableHead className="hidden sm:table-cell">Email</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="hidden md:table-cell">Turma</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">A carregar...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma pessoa encontrada</TableCell></TableRow>
            ) : (
              filtered.map(p => (
                <TableRow key={p.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => { setSelected(p); setDetailOpen(true); }}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {p.foto ? (
                        <img src={p.foto} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{p.nome?.[0]}</div>
                      )}
                      <span className="font-medium">{p.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{p.email}</TableCell>
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
                  body: emailForm.corpo 
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Escalão ASE/AF</Label>
                  <Select value={form.escalao || 'Não'} onValueChange={v => setForm({...form, escalao: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Não">Não</SelectItem>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                      <SelectItem value="ASE">ASE</SelectItem>
                      <SelectItem value="1º">1º</SelectItem>
                      <SelectItem value="2º">2º</SelectItem>
                      <SelectItem value="3º">3º</SelectItem>
                      <SelectItem value="4º">4º</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <Checkbox id="ne" checked={form.ne || false} onCheckedChange={v => setForm({...form, ne: v})} />
                  <Label htmlFor="ne" className="cursor-pointer">NE (Nec. Especiais)</Label>
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
            ne: { type: 'boolean' },
            ee_nome: { type: 'string' },
            ee_tipo_doc: { type: 'string' },
            ee_num_doc: { type: 'string' },
            ee_morada: { type: 'string' },
            ee_email: { type: 'string' },
            ee_nif: { type: 'string' },
            ee_telefone: { type: 'string' }
          }
        }}
      />
    </div>
  );
}
