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
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, FileDown, Mail, Loader2 } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import PageHeader from '@/components/shared/PageHeader';
import FileUpload from '@/components/shared/FileUpload';
import AcessoriosCheck from '@/components/shared/AcessoriosCheck';
import SmartScanner from '@/components/shared/SmartScanner';
import RichTextEditor from '@/components/shared/RichTextEditor';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { gerarPDFEmprestimo } from '@/utils/pdfGenerator';
import { useAuth } from '@/lib/AuthContext';

const PROTECTED_EMAIL = 'pedro.mf.santos@outlook.pt';

// Inline mini forms for creating equipment/person
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
    <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
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
  const { user } = useAuth();
  const isAdmin = user?.email === PROTECTED_EMAIL || user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('ATIVO');
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

  const { data: emprestimos = [], isLoading } = useQuery({
    queryKey: ['emprestimos'],
    queryFn: () => db.entities.Emprestimo.list('-created_at')
  });
  const { data: equipamentos = [] } = useQuery({
    queryKey: ['equipamentos'], queryFn: () => db.entities.Equipamento.list()
  });
  const { data: pessoas = [] } = useQuery({
    queryKey: ['pessoas'], queryFn: () => db.entities.Pessoa.list()
  });
  const { data: pdfTemplates = [] } = useQuery({
    queryKey: ['doc-templates'], queryFn: () => db.entities.DocumentoTemplate.list()
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const emp = await db.entities.Emprestimo.create({
        equipamento_id: selectedEq.id,
        pessoa_id: selectedPessoa.id,
        equipamento_info: `${selectedEq.designacao} (${selectedEq.numero_serie})`,
        pessoa_info: selectedPessoa.nome,
        data_emprestimo: new Date().toISOString().split('T')[0],
        estado: 'ATIVO',
        notas_entrega: notas,
        acessorios_entregues: acessorios,
        autorizacao_ee: autorizacaoEE,
        ee_levanta: eeLevanta,
        inserido_sistema: inseridoSistema,
        documentos_entrega: docs
      });
      await db.entities.Equipamento.update(selectedEq.id, { estado: 'EMPRESTADO' });
      return emp;
    },
    onSuccess: (emp) => {
      qc.invalidateQueries({ queryKey: ['emprestimos'] });
      qc.invalidateQueries({ queryKey: ['equipamentos'] });
      // Auto PDF
      gerarPDFEmprestimo({
        ...emp,
        equipamento_info: `${selectedEq.designacao} (${selectedEq.numero_serie})`,
        pessoa_info: selectedPessoa.nome,
        acessorios_entregues: acessorios,
        notas_entrega: notas
      }, pdfTemplates);
      resetForm();
      toast.success('Empréstimo registado. PDF gerado.');
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

  const filteredEq = equipamentos.filter(e =>
    e.estado === 'DISPONÍVEL' &&
    (eqSearch === '' || [e.numero_serie, e.numero_imobilizado, e.designacao, e.marca, e.modelo].some(f => f?.toLowerCase().includes(eqSearch.toLowerCase())))
  );

  const filteredPessoas = pessoas.filter(p =>
    p.ativo !== false &&
    (pessoaSearch === '' || [p.nome, p.email, p.turma, p.nif, p.telefone].some(f => f?.toLowerCase().includes(pessoaSearch.toLowerCase())))
  );

  const filtered = (emprestimos || [])
    .filter(e => {
      const matchSearch = !search || [e.equipamento_info, e.pessoa_info].some(f => f?.toLowerCase().includes(search.toLowerCase()));
      const matchEstado = filtroEstado === 'todos' || e.estado === filtroEstado;
      return matchSearch && matchEstado;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    });

  const handlePDF = (emp, e) => {
    e.stopPropagation();
    gerarPDFEmprestimo(emp, pdfTemplates);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Empréstimos" subtitle={`${emprestimos.filter(e => e.estado === 'ATIVO').length} empréstimo(s) ativo(s)`} action={() => setFormOpen(true)} actionLabel="Novo Empréstimo" />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <SmartScanner onResult={v => setSearch(v)} label="Pesquisar por scanner" />
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
              <TableHead>Equipamento</TableHead>
              <TableHead>Pessoa</TableHead>
              <TableHead className="hidden sm:table-cell">Data</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">A carregar...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum empréstimo encontrado</TableCell></TableRow>
            ) : (
              filtered.map(emp => (
                <TableRow key={emp.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => { setDetailItem(emp); setDetailOpen(true); }}>
                  <TableCell className="font-medium">{emp.equipamento_info}</TableCell>
                  <TableCell>{emp.pessoa_info}</TableCell>
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
                      <Button variant="ghost" size="icon" title="PDF" onClick={e => handlePDF(emp, e)}><FileDown className="w-4 h-4" /></Button>
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
                      <Input placeholder="Nome, nº série, imobilizado..." value={eqSearch} onChange={e => setEqSearch(e.target.value)} className="flex-1" />
                      <SmartScanner onResult={v => setEqSearch(v)} label="Ler Equipamento" />
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {filteredEq.slice(0, 10).map(eq => (
                        <button key={eq.id} onClick={() => setSelectedEq(eq)} className="w-full text-left p-2 rounded hover:bg-muted text-sm">{eq.designacao} — {eq.numero_serie}</button>
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
                      {filteredPessoas.slice(0, 10).map(p => (
                        <button key={p.id} onClick={() => setSelectedPessoa(p)} className="w-full text-left p-2 rounded hover:bg-muted text-sm">{p.nome} — {p.tipo} {p.turma ? `(${p.turma})` : ''}</button>
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
              <p className="text-xs text-muted-foreground">Um PDF será gerado automaticamente após confirmar.</p>
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
              {detailItem.documentos_entrega?.filter(d => d.ativo !== false).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground font-semibold">Documentos de Entrega</p>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {detailItem.documentos_entrega.filter(d => d.ativo !== false).map((doc, i) => (
                      <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded border hover:bg-muted/50 text-center text-xs">{doc.nome}</a>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => { gerarPDFEmprestimo(detailItem, pdfTemplates); }}>
                  <FileDown className="w-4 h-4 mr-1" />PDF
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
