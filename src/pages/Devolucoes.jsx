import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// Note: useQueryClient used in sub-components below
import { db } from '@/api/db';

import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Search, AlertTriangle, Plus, FileDown } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import PageHeader from '@/components/shared/PageHeader';
import FileUpload from '@/components/shared/FileUpload';
import AcessoriosCheck, { ACESSORIOS } from '@/components/shared/AcessoriosCheck';
import SmartScanner from '@/components/shared/SmartScanner';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CornerDownLeft } from 'lucide-react';
import { gerarPDFDevolucao } from '@/utils/pdfGenerator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';

const PROTECTED_EMAIL = 'pedro.mf.santos@outlook.pt';

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

export default function Devolucoes() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.email === PROTECTED_EMAIL || user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('A REVER');
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

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
    queryKey: ['devolucoes'],
    queryFn: () => db.entities.Devolucao.list('-created_at')
  });
  const { data: emprestimosAtivos = [] } = useQuery({
    queryKey: ['emprestimos-ativos'],
    queryFn: () => db.entities.Emprestimo.filter({ estado: 'ATIVO' }, '-created_date')
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

  const devolveMutation = useMutation({
    mutationFn: async () => {
      const hoje = new Date().toISOString().split('T')[0];
      let empInfo, eqId, pessoaId, eqInfo, pessoaInfo, empId;

      if (modoLivre) {
        eqId = selectedEq.id;
        pessoaId = selectedPessoa.id;
        eqInfo = `${selectedEq.designacao} (${selectedEq.numero_serie})`;
        pessoaInfo = selectedPessoa.nome;
        // Create a fake loan first
        const empCriado = await db.entities.Emprestimo.create({
          equipamento_id: eqId, pessoa_id: pessoaId,
          equipamento_info: eqInfo, pessoa_info: pessoaInfo,
          data_emprestimo: hoje, estado: 'ATIVO', notas_entrega: 'Criado automaticamente na devolução'
        });
        empId = empCriado.id;
      } else {
        empInfo = selectedEmp;
        eqId = selectedEmp.equipamento_id;
        pessoaId = selectedEmp.pessoa_id;
        eqInfo = selectedEmp.equipamento_info;
        pessoaInfo = selectedEmp.pessoa_info;
        empId = selectedEmp.id;
      }

      const devolucao = await db.entities.Devolucao.create({
        emprestimo_id: empId,
        equipamento_id: eqId,
        pessoa_id: pessoaId,
        equipamento_info: eqInfo,
        pessoa_info: pessoaInfo,
        data_devolucao: hoje,
        estado_equipamento: estadoEquipamento,
        notas,
        documentos: docs,
        acessorios_devolvidos: acessoriosDevolvidos
      });

      // Update empréstimo
      const empEstado = estadoEquipamento === 'COM DANOS' ? 'DANOS PARA REVISÃO' : 'PARA REVISÃO';
      await db.entities.Emprestimo.update(empId, { estado: empEstado, notas_devolucao: notas });

      // Update equipment + create avaria
      await db.entities.Equipamento.update(eqId, { estado: 'EM AVARIA' });
      await db.entities.Avaria.create({
        equipamento_id: eqId,
        equipamento_info: eqInfo,
        origem: 'DEVOLUÇÃO',
        devolucao_id: devolucao.id,
        estado: 'A REVER',
        componentes: { ecra: 'DESCONHECIDO', disco: 'DESCONHECIDO', ram: 'DESCONHECIDO', board: 'DESCONHECIDO', bateria: 'DESCONHECIDO', teclado: 'DESCONHECIDO', touchpad: 'DESCONHECIDO' },
        historico_estados: [{ tipo: 'estado', estado: 'A REVER', data: new Date().toISOString(), utilizador: 'Sistema' }]
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

  const resetForm = () => {
    setFormOpen(false); setSelectedEmp(null); setEmpSearch('');
    setEstadoEquipamento('A REVER'); setNotas(''); setDocs([]);
    setAcessoriosDevolvidos({}); setStep(1); setModoLivre(false);
    setSelectedEq(null); setSelectedPessoa(null); setEqSearch(''); setPessoaSearch('');
    setCreateEq(false); setCreatePessoa(false);
  };

  const filteredEmp = emprestimosAtivos.filter(e =>
    empSearch === '' || [e.equipamento_info, e.pessoa_info].some(f => f?.toLowerCase().includes(empSearch.toLowerCase()))
  );

  const filteredEq = equipamentos.filter(e =>
    eqSearch === '' || [e.numero_serie, e.numero_imobilizado, e.designacao, e.marca, e.modelo].some(f => f?.toLowerCase().includes(eqSearch.toLowerCase()))
  );

  const filteredPessoas = pessoas.filter(p =>
    pessoaSearch === '' || [p.nome, p.email, p.turma, p.nif, p.telefone].some(f => f?.toLowerCase().includes(pessoaSearch.toLowerCase()))
  );

  const filteredDev = (devolucoes || [])
    .filter(d => {
      const matchSearch = !search || [d.equipamento_info, d.pessoa_info].some(f => f?.toLowerCase().includes(search.toLowerCase()));
      const matchEstado = filtroEstado === 'todos' || d.estado_equipamento === filtroEstado;
      return matchSearch && matchEstado;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    });

  // Acessórios entregues do empréstimo selecionado
  const acessoriosEntregues = selectedEmp?.acessorios_entregues || {};

  return (
    <div className="space-y-6">
      <PageHeader title="Devoluções" subtitle="Registar e consultar devoluções" action={() => setFormOpen(true)} actionLabel="Nova Devolução" actionIcon={CornerDownLeft} />

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
              <TableHead>Pessoa</TableHead>
              <TableHead className="hidden sm:table-cell">Data</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">A carregar...</TableCell></TableRow>
            ) : filteredDev.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma devolução encontrada</TableCell></TableRow>
            ) : (
              filteredDev.map(d => (
                <TableRow key={d.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => { setDetailItem(d); setDetailOpen(true); }}>
                  <TableCell className="font-medium">{d.equipamento_info}</TableCell>
                  <TableCell>{d.pessoa_info}</TableCell>
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
                          <p className="text-sm font-medium">{selectedEmp.equipamento_info}</p>
                          <p className="text-xs text-muted-foreground">{selectedEmp.pessoa_info} — desde {format(new Date(selectedEmp.data_emprestimo), 'dd/MM/yyyy')}</p>
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
                        <Input placeholder="Pesquisar por pessoa ou equipamento..." value={empSearch} onChange={e => setEmpSearch(e.target.value)} className="flex-1" />
                        <SmartScanner onResult={v => setEmpSearch(v)} label="Ler Empréstimo" />
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1 mt-1">
                        {filteredEmp.map(emp => (
                          <button key={emp.id} onClick={() => setSelectedEmp(emp)} className="w-full text-left p-2 rounded hover:bg-muted text-sm">
                            <span className="font-medium">{emp.equipamento_info}</span> — {emp.pessoa_info}
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
                            {filteredEq.slice(0, 8).map(eq => (
                              <button key={eq.id} onClick={() => setSelectedEq(eq)} className="w-full text-left p-1.5 rounded hover:bg-muted text-sm">{eq.designacao} — {eq.numero_serie}</button>
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
                            {filteredPessoas.slice(0, 8).map(p => (
                              <button key={p.id} onClick={() => setSelectedPessoa(p)} className="w-full text-left p-1.5 rounded hover:bg-muted text-sm">{p.nome} — {p.tipo}</button>
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

              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">Será criada automaticamente uma avaria com estado "A REVER" para este equipamento.</p>
              </div>

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
                <p className="text-xs text-amber-800">Avaria será criada automaticamente. Um PDF será gerado.</p>
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
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => { gerarPDFDevolucao(detailItem, pdfTemplates); }}>
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
