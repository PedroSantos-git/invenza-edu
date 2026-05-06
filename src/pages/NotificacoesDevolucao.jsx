import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { EmailService } from '@/api/emailService';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Mail, Loader2, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, Send, Filter, CheckCircle2 } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function NotificacoesDevolucao() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Filters State
  const [statusPessoa, setStatusPessoa] = useState('todos'); // todos, inativas, ativas
  const [emailFilter, setEmailFilter] = useState('todos'); // todos, sem_email, com_email, com_email_externo
  const [turmaFilter, setTurmaFilter] = useState('todos');
  const [tipoPessoaFilter, setTipoPessoaFilter] = useState('todos'); // todos, Aluno, Docente
  const [searchPessoa, setSearchPessoa] = useState('');
  const [searchEquipamento, setSearchEquipamento] = useState('');
  
  const [sortConfig, setSortConfig] = useState({ key: 'data_emprestimo', direction: 'desc' });
  const [selectedLoans, setSelectedLoans] = useState([]);
  const [motivoGeral, setMotivoGeral] = useState('Fim do período letivo / Cessação de funções');

  // Data Fetching
  const { data: emprestimos = [], isLoading: loadingEmprestimos } = useQuery({
    queryKey: ['emprestimos-notificacoes'],
    queryFn: () => db.entities.Emprestimo.filter({ estado: 'ATIVO' })
  });

  const { data: pessoas = [], isLoading: loadingPessoas } = useQuery({
    queryKey: ['pessoas-notificacoes'],
    queryFn: () => db.entities.Pessoa.list()
  });

  const { data: equipamentos = [], isLoading: loadingEquipamentos } = useQuery({
    queryKey: ['equipamentos-notificacoes'],
    queryFn: () => db.entities.Equipamento.list()
  });

  const isLoading = loadingEmprestimos || loadingPessoas || loadingEquipamentos;

  // Process Data
  const processedData = useMemo(() => {
    if (isLoading) return [];

    const pessoaMap = new Map(pessoas.map(p => [p.id, p]));
    const eqMap = new Map(equipamentos.map(e => [e.id, e]));

    let data = emprestimos.map(emp => {
      const pessoa = pessoaMap.get(emp.pessoa_id);
      const eq = eqMap.get(emp.equipamento_id);
      const eqLabel = eq ? `${eq.tipo} ${eq.marca} ${eq.modelo}`.trim() : emp.equipamento_info;
      const eqSn = eq?.numero_serie || emp.equipamento_sn;
      const eqImob = eq?.numero_imobilizado;

      return {
        ...emp,
        pessoa,
        equipamento: eq,
        eqLabel,
        eqSn,
        eqImob,
        pessoa_nome: pessoa?.nome || emp.pessoa_info,
        pessoa_nif: pessoa?.nif || emp.pessoa_nif,
        pessoa_turma: pessoa?.turma || '—',
        pessoa_tipo: pessoa?.tipo || '—',
        pessoa_ativo: pessoa?.ativo ?? true,
        pessoa_processo: pessoa?.n_processo || '—',
        ee_nif: pessoa?.ee_nif || '—'
      };
    });

    // Apply Filters
    return data.filter(item => {
      // Status Pessoa
      if (statusPessoa === 'inativas' && item.pessoa_ativo) return false;
      if (statusPessoa === 'ativas' && !item.pessoa_ativo) return false;

      // Email Filter
      const p = item.pessoa;
      const emails = [p?.email, p?.email_pessoal, p?.ee_email].filter(Boolean);
      const hasAnyEmail = emails.length > 0;
      const hasExternalEmail = emails.some(e => !e.toLowerCase().endsWith('@djoaoii.com'));

      if (emailFilter === 'sem_email' && hasAnyEmail) return false;
      if (emailFilter === 'com_email' && !hasAnyEmail) return false;
      if (emailFilter === 'com_email_externo' && !hasExternalEmail) return false;

      // Tipo Pessoa
      if (tipoPessoaFilter !== 'todos' && item.pessoa_tipo !== tipoPessoaFilter) return false;

      // Turma Filter
      if (turmaFilter !== 'todos' && item.pessoa_turma !== turmaFilter) return false;

      // Search Pessoa: Nome, NIF pessoa, NIF EE, Turma, Nº Processo
      if (searchPessoa) {
        const s = searchPessoa.toLowerCase();
        const match = [
          item.pessoa_nome,
          item.pessoa_nif,
          item.ee_nif,
          item.pessoa_turma,
          item.pessoa_processo
        ].some(f => String(f || '').toLowerCase().includes(s));
        if (!match) return false;
      }

      // Search Equipamento: Tipo Marca Modelo, SN, Imobilizado
      if (searchEquipamento) {
        const s = searchEquipamento.toLowerCase();
        const match = [
          item.eqLabel,
          item.eqSn,
          item.eqImob
        ].some(f => String(f || '').toLowerCase().includes(s));
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [emprestimos, pessoas, equipamentos, statusPessoa, emailFilter, tipoPessoaFilter, turmaFilter, searchPessoa, searchEquipamento, sortConfig, isLoading]);

  // Extract classes from the filtered list
  const classes = useMemo(() => {
    const set = new Set();
    processedData.forEach(item => {
      if (item.pessoa_turma && item.pessoa_turma !== '—') set.add(item.pessoa_turma);
    });
    return Array.from(set).sort();
  }, [processedData]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleSelectAll = () => {
    if (selectedLoans.length === processedData.length) {
      setSelectedLoans([]);
    } else {
      setSelectedLoans(processedData.map(d => d.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedLoans(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const sendEmailsMutation = useMutation({
    mutationFn: async () => {
      const selectedData = processedData.filter(d => selectedLoans.includes(d.id));
      
      // Agrupar equipamentos por pessoa
      const groupedByPerson = new Map();
      selectedData.forEach(item => {
        const personId = item.pessoa_id;
        if (!groupedByPerson.has(personId)) {
          groupedByPerson.set(personId, {
            pessoa: item.pessoa,
            equipamentos: []
          });
        }
        groupedByPerson.get(personId).equipamentos.push(item);
      });

      // Verificar se o template existe e carregá-lo uma única vez
      const templates = await db.entities.EmailTemplate.list();
      const template = templates.find(t => t.tipo === 'SOLICITAR_DEVOLUCAO');
      
      if (!template) {
        throw new Error('O template "SOLICITAR_DEVOLUCAO" não existe. Vá a Configurações > Gerar Base primeiro.');
      }

      let success = 0;
      let errors = 0;
      let skippedNoEmail = 0;

      const totalPessoas = groupedByPerson.size;
      let current = 0;

      for (const [personId, group] of groupedByPerson.entries()) {
        current++;
        try {
          const p = group.pessoa;
          const emails = [p?.email, p?.email_pessoal, p?.ee_email].filter(Boolean);
          const to = emails[0];
          
          if (!to) {
            skippedNoEmail++;
            continue;
          }

          const cc = (p.tipo === 'Aluno' && p.ee_email && p.ee_email !== to) ? p.ee_email : undefined;
          const listaEquipamentos = group.equipamentos
            .map(eq => `${eq.eqLabel} (S/N: ${eq.eqSn})`)
            .join(', ');

          // Substituir variáveis manualmente para evitar múltiplas chamadas ao DB no EmailService
          const subject = EmailService.replaceVars(template.assunto, {
            pessoa: p.nome,
            equipamento: listaEquipamentos,
            motivo: motivoGeral
          });
          const body = EmailService.replaceVars(template.corpo, {
            pessoa: p.nome,
            equipamento: listaEquipamentos,
            motivo: motivoGeral
          });

          await EmailService.send({ 
            to, 
            cc, 
            subject, 
            body, 
            pessoa_id: personId, 
            tipo: 'SOLICITAR_DEVOLUCAO' 
          });
          success++;
        } catch (err) {
          console.error('Erro ao enviar email para', personId, err);
          errors++;
        }
      }
      return { success, errors, skippedNoEmail, totalPessoas };
    },
    onMutate: () => {
      toast.loading('A iniciar envio de notificações...', { id: 'bulk-email' });
    },
    onSuccess: (res) => {
      toast.dismiss('bulk-email');
      if (res.success > 0) {
        toast.success(`Sucesso: ${res.success} emails enviados.`);
      }
      if (res.skippedNoEmail > 0) {
        toast.warning(`${res.skippedNoEmail} pessoas sem email ignoradas.`);
      }
      if (res.errors > 0) {
        toast.error(`${res.errors} erros detetados no envio.`);
      }
      if (res.success === 0 && res.errors === 0 && res.skippedNoEmail === 0) {
        toast.info('Nenhum dado processado.');
      }
      setSelectedLoans([]);
    },
    onError: (err) => {
      toast.dismiss('bulk-email');
      toast.error(err.message || 'Erro crítico no processo de envio.');
    }
  });

  const isSendingBulk = sendEmailsMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/emprestimos')}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <PageHeader 
          title="Notificações de Devolução" 
          subtitle="Envio em massa de pedidos de devolução de equipamentos."
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filtros Avançados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Estado da Pessoa</Label>
              <Select value={statusPessoa} onValueChange={setStatusPessoa}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="ativas">Ativas</SelectItem>
                  <SelectItem value="inativas">Inativas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Select value={emailFilter} onValueChange={setEmailFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="com_email">Com Email (qualquer)</SelectItem>
                  <SelectItem value="com_email_externo">Com Email Externo</SelectItem>
                  <SelectItem value="sem_email">Sem Email</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={tipoPessoaFilter} onValueChange={setTipoPessoaFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="Aluno">Alunos</SelectItem>
                  <SelectItem value="Docente">Docentes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Turma</Label>
              <Select value={turmaFilter} onValueChange={setTurmaFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Pesquisar Pessoa (Nome, NIF, Turma, Processo...)</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input 
                  placeholder="Pesquisar pessoa..." 
                  value={searchPessoa} 
                  onChange={e => setSearchPessoa(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Pesquisar Equipamento (Tipo, Marca, Modelo, S/N, Imob...)</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input 
                  placeholder="Pesquisar equipamento..." 
                  value={searchEquipamento} 
                  onChange={e => setSearchEquipamento(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg border border-primary/10">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Ações em Massa</p>
          <p className="text-xs text-muted-foreground">
            {selectedLoans.length} empréstimos selecionados de {processedData.length} filtrados.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1 min-w-[300px]">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Motivo da Solicitação</Label>
            <Input 
              value={motivoGeral} 
              onChange={e => setMotivoGeral(e.target.value)} 
              className="h-9 bg-white"
              placeholder="Ex: Fim do contrato / Cessação de funções"
            />
          </div>
          <Button 
            disabled={selectedLoans.length === 0 || isSendingBulk} 
            onClick={() => sendEmailsMutation.mutate()}
            className="shadow-sm"
          >
            {isSendingBulk ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Enviar Notificações ({selectedLoans.length})
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">
                <input 
                  type="checkbox" 
                  checked={selectedLoans.length === processedData.length && processedData.length > 0} 
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300"
                />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('pessoa_nome')}>
                Pessoa {sortConfig.key === 'pessoa_nome' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />)}
              </TableHead>
              <TableHead>Turma/Tipo</TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('eqLabel')}>
                Equipamento {sortConfig.key === 'eqLabel' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />)}
              </TableHead>
              <TableHead>S/N / Imob</TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('data_emprestimo')}>
                Data {sortConfig.key === 'data_emprestimo' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />)}
              </TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : processedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Nenhum empréstimo encontrado com estes filtros.
                </TableCell>
              </TableRow>
            ) : (
              processedData.map(item => {
                const isSelected = selectedLoans.includes(item.id);
                return (
                  <TableRow key={item.id} className={`${isSelected ? 'bg-primary/5' : ''} hover:bg-muted/30`}>
                    <TableCell>
                      <input 
                        type="checkbox" 
                        checked={isSelected} 
                        onChange={() => toggleSelect(item.id)}
                        className="rounded border-gray-300"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{item.pessoa_nome}</span>
                        <span className="text-[10px] text-muted-foreground">{item.pessoa_nif}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="w-fit text-[10px] py-0">{item.pessoa_tipo}</Badge>
                        <span className="text-xs">{item.pessoa_turma}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{item.eqLabel}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono text-[10px]">{item.eqSn}</span>
                        {item.eqImob && <span className="text-[10px] text-muted-foreground">Imob: {item.eqImob}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(item.data_emprestimo), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      {!item.pessoa_ativo && <Badge variant="destructive" className="text-[10px] uppercase">Inativo</Badge>}
                      {item.pessoa_ativo && <Badge variant="secondary" className="text-[10px] uppercase text-emerald-600 bg-emerald-50">Ativo</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
