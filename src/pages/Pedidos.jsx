import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { EmailService } from '@/api/emailService';

import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, X, Calendar, Mail, Clock, LifeBuoy, FileText, AlertCircle, Loader2, Plus, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatusBadge from '@/components/shared/StatusBadge';
import PageHeader from '@/components/shared/PageHeader';
import SmartScanner from '@/components/shared/SmartScanner';
import RichTextEditor from '@/components/shared/RichTextEditor';
import PedidoDetail from '@/components/pedidos/PedidoDetail';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function Pedidos() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('PENDENTE');
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [actionType, setActionType] = useState(''); // 'DOCS', 'AGENDAR', 'REJEITAR', 'INFO'
  const [actionText, setActionText] = useState('');
  const [actionDate, setActionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const isHtmlEmpty = (html) => {
    const text = (html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
    return text.length === 0;
  };

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['pedidos'],
    queryFn: () => db.entities.Pedido.list('-created_at')
  });

  const { data: pessoas = [] } = useQuery({
    queryKey: ['pessoas'],
    queryFn: () => db.entities.Pessoa.list()
  });

  const processMutation = useMutation({
    mutationFn: async ({ pedido, status, extraData, emailType, emailVars }) => {
      const pessoa = pessoas.find(p => p.id === pedido.pessoa_id);
      
      // 1. Atualizar Pedido no DB
      await db.entities.Pedido.update(pedido.id, { 
        status, 
        resolvido: true,
        ...extraData
      });

      // 2. Enviar Email se configurado
      if (emailType && pessoa?.email) {
        const cc = (pessoa.tipo === 'Aluno' && pessoa.ee_email) ? pessoa.ee_email : undefined;
        await EmailService.sendTemplate({
          tipo: emailType,
          to: pessoa.email,
          cc,
          vars: {
            pessoa: pessoa.nome,
            ...emailVars
          }
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos'] });
      setActionDialogOpen(false);
      setSelectedPedido(null);
      setActionText('');
      toast.success('Pedido processado e notificação enviada.');
    },
    onError: (err) => {
      toast.error('Erro ao processar pedido: ' + err.message);
    }
  });

  const filtered = (pedidos || [])
    .filter(p => {
      const matchSearch = !search || 
        p.pessoa_info?.toLowerCase().includes(search.toLowerCase()) ||
        p.notas?.toLowerCase().includes(search.toLowerCase()) ||
        p.numero_serie?.toLowerCase().includes(search.toLowerCase()) ||
        p.numero_imobilizado?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filtroStatus === 'todos' || p.status === filtroStatus;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    });

  const getPessoaInfo = (pessoaId) => {
    return pessoas.find(p => p.id === pessoaId);
  };

  const openAction = (pedido, type) => {
    setSelectedPedido(pedido);
    setActionType(type);
    setActionText('');
    setActionDate(format(new Date(), 'yyyy-MM-dd'));
    setActionDialogOpen(true);
  };

  const handleActionSubmit = () => {
    if (!selectedPedido) return;

    let status = 'RESOLVIDO';
    let emailType = '';
    let emailVars = {};
    let extraData = {};

    if (actionType === 'DOCS') {
      status = 'RESOLVIDO';
      emailType = 'PEDIDO_DOCS_FALTA';
      emailVars = { docs_em_falta: actionText };
      extraData = { documentos_em_falta: actionText };
    } else if (actionType === 'AGENDAR') {
      status = 'AGENDADO';
      const isSuporte = selectedPedido.tipo === 'SUPORTE';
      const isDevolucao = selectedPedido.tipo === 'DEVOLUÇÃO';
      emailType = isSuporte ? 'SUPORTE_AGENDADO' : (isDevolucao ? 'DEVOLUÇÃO_AGENDADA' : 'PEDIDO_AGENDADO');
      emailVars = { data_agendamento: format(new Date(actionDate), 'dd/MM/yyyy') };
      extraData = { data_agendamento: actionDate };
    } else if (actionType === 'REJEITAR') {
      status = 'REJEITADO';
      const isSuporte = selectedPedido.tipo === 'SUPORTE';
      const isDevolucao = selectedPedido.tipo === 'DEVOLUÇÃO';
      emailType = isSuporte ? 'SUPORTE_REJEITADO' : (isDevolucao ? 'DEVOLUÇÃO_REJEITADA' : 'PEDIDO_REJEITADO');
      emailVars = { motivo_rejeicao: actionText };
      extraData = { motivo_rejeicao: actionText };
    } else if (actionType === 'INFO') {
      status = 'RESOLVIDO';
      const isSuporte = selectedPedido.tipo === 'SUPORTE';
      const isDevolucao = selectedPedido.tipo === 'DEVOLUÇÃO';
      emailType = isSuporte ? 'SUPORTE_INFO' : (isDevolucao ? 'DEVOLUÇÃO_INFO' : 'GERAL');
      emailVars = { info_adicional: actionText, corpo: actionText };
      extraData = { info_adicional: actionText };
    }

    processMutation.mutate({
      pedido: selectedPedido,
      status,
      extraData,
      emailType,
      emailVars
    });
  };

  const renderPedidoRow = (p) => {
    const pessoa = getPessoaInfo(p.pessoa_id);
    const isSuporte = p.tipo === 'SUPORTE';
    
    return (
      <TableRow 
        key={p.id} 
        className="hover:bg-muted/30 cursor-pointer" 
        onClick={() => { setSelectedPedido(p); setDetailOpen(true); }}
      >
        <TableCell>
          <div className="flex flex-col">
            <span className="font-bold text-sm">{p.pessoa_info}</span>
            <span className="text-[10px] text-muted-foreground font-mono">{pessoa?.email || '—'}</span>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              {p.tipo === 'EMPRÉSTIMO' && <Plus className="w-3 h-3 text-emerald-600" />}
              {p.tipo === 'DEVOLUÇÃO' && <Calendar className="w-3 h-3 text-blue-600" />}
              {p.tipo === 'SUPORTE' && <LifeBuoy className="w-3 h-3 text-amber-600" />}
              <span className="text-[10px] font-black uppercase tracking-tighter">{p.tipo}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{format(new Date(p.data_pedido), 'dd/MM/yyyy')}</span>
          </div>
        </TableCell>
        <TableCell>
          {isSuporte ? (
            <div className="text-[10px] space-y-0.5 bg-amber-50/50 p-1.5 rounded border border-amber-100">
              <p className="font-bold text-amber-900 uppercase">{p.descricao_equipamento}</p>
              <div className="flex gap-2 text-amber-700">
                {p.numero_serie && <span>S/N: {p.numero_serie}</span>}
                {p.numero_imobilizado && <span>INV: {p.numero_imobilizado}</span>}
              </div>
            </div>
          ) : (
            pessoa?.tipo === 'Aluno' ? (
              <div className="text-[10px] space-y-0.5">
                <p><span className="text-muted-foreground font-bold uppercase">EE:</span> {pessoa.ee_nome || '—'}</p>
                <p><span className="text-muted-foreground font-bold uppercase">Tel:</span> {pessoa.ee_telefone || '—'}</p>
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground font-bold uppercase">Docente</span>
            )
          )}
        </TableCell>
        <TableCell className="max-w-[200px] text-[11px] leading-tight">
          {isSuporte ? (
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-amber-800 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Problema:</span>
              <span className="italic line-clamp-2">{p.descricao_suporte}</span>
            </div>
          ) : (
            p.notas || <span className="text-muted-foreground italic">Sem notas</span>
          )}
        </TableCell>
        <TableCell>
          <StatusBadge status={p.status} />
          {p.data_agendamento && (
            <div className="text-[10px] text-blue-600 font-bold mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {format(new Date(p.data_agendamento), 'dd/MM/yyyy')}
            </div>
          )}
        </TableCell>
        <TableCell className="text-right">
          {!p.resolvido && (
            <div className="flex justify-end gap-1">
              {p.tipo === 'EMPRÉSTIMO' && (
                <Button variant="outline" size="xs" className="h-7 text-[10px] border-emerald-200 hover:bg-emerald-50 text-emerald-700" onClick={() => openAction(p, 'DOCS')}>
                  <FileText className="w-3 h-3 mr-1" /> Docs
                </Button>
              )}
              {(p.tipo === 'SUPORTE' || p.tipo === 'DEVOLUÇÃO') && (
                <Button variant="outline" size="xs" className="h-7 text-[10px] border-amber-200 hover:bg-amber-50 text-amber-700" onClick={() => openAction(p, 'INFO')}>
                  <Mail className="w-3 h-3 mr-1" /> Info
                </Button>
              )}
              <Button variant="outline" size="xs" className="h-7 text-[10px] border-blue-200 hover:bg-blue-50 text-blue-700" onClick={() => openAction(p, 'AGENDAR')}>
                <Calendar className="w-3 h-3 mr-1" /> Agendar
              </Button>
              <Button variant="outline" size="xs" className="h-7 text-[10px] border-red-200 hover:bg-red-50 text-red-700" onClick={() => openAction(p, 'REJEITAR')}>
                <X className="w-3 h-3 mr-1" /> Rejeitar
              </Button>
            </div>
          )}
          {p.resolvido && (
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[9px] font-black text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded">CONCLUÍDO</span>
              {p.motivo_rejeicao && <span className="text-[9px] text-red-500 font-medium italic">Rejeitado: {p.motivo_rejeicao}</span>}
              {p.documentos_em_falta && <span className="text-[9px] text-emerald-600 font-medium italic">Docs: {p.documentos_em_falta}</span>}
            </div>
          )}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Pedidos" subtitle="Gestão de pedidos de empréstimo, devolução e suporte técnico" />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Pesquisar por nome, email, série, imobilizado..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="pl-9 h-10 shadow-sm" 
            />
          </div>
          <SmartScanner onResult={v => setSearch(v)} label="Pesquisar por scanner" />
        </div>
        
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-full sm:w-[200px] h-10">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <SelectValue placeholder="Estado" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Estados</SelectItem>
            <SelectItem value="PENDENTE">Pendentes</SelectItem>
            <SelectItem value="AGENDADO">Agendados</SelectItem>
            <SelectItem value="REJEITADO">Rejeitados</SelectItem>
            <SelectItem value="RESOLVIDO">Resolvidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <TableHead>Utilizador / Email</TableHead>
              <TableHead>Tipo / Data</TableHead>
              <TableHead>Informação</TableHead>
              <TableHead>Notas / Detalhes</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-20">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-xs font-medium uppercase tracking-tighter">A carregar pedidos...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic text-xs">
                  Nenhum pedido encontrado com os filtros atuais.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(p => renderPedidoRow(p))
            )}
          </TableBody>
        </Table>
      </div>

      <PedidoDetail 
        open={detailOpen} 
        onClose={() => setDetailOpen(false)} 
        pedido={selectedPedido} 
      />

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === 'DOCS' && <><FileText className="w-5 h-5 text-emerald-600" /> Documentos em Falta</>}
              {actionType === 'AGENDAR' && <><Calendar className="w-5 h-5 text-blue-600" /> Agendar Atendimento</>}
              {actionType === 'REJEITAR' && <><X className="w-5 h-5 text-red-600" /> Rejeitar Pedido</>}
              {actionType === 'INFO' && <><Mail className="w-5 h-5 text-amber-600" /> Solicitar Informação</>}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {actionType === 'AGENDAR' ? (
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Data do Agendamento</Label>
                <Input type="date" value={actionDate} onChange={e => setActionDate(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">
                  {actionType === 'DOCS' ? 'Documentos em Falta' : 
                   actionType === 'REJEITAR' ? 'Motivo da Rejeição' : 
                   'Texto para o Email'}
                </Label>
                <RichTextEditor
                  value={actionText || ''}
                  onChange={(content) => setActionText(content)}
                  showDocxTools={false}
                  showHelp={false}
                  height={220}
                  menubar={false}
                  toolbar="undo redo | blocks | bold italic underline | forecolor backcolor | alignleft aligncenter alignright | bullist numlist | link | removeformat"
                  plugins={['lists', 'link', 'autolink', 'code']}
                />
              </div>
            )}
            
            <div className="bg-muted/30 p-3 rounded-lg border border-dashed text-[10px] text-muted-foreground">
              <p className="flex items-center gap-1 font-bold mb-1"><Mail className="w-3 h-3" /> Notificação automática:</p>
              <p>Ao confirmar, o pedido será marcado como resolvido e um email será enviado para o utilizador 
                {selectedPedido?.pessoa_info && <strong> ({selectedPedido.pessoa_info})</strong>}.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleActionSubmit} 
              disabled={processMutation.isPending || (actionType !== 'AGENDAR' && isHtmlEmpty(actionText))}
              className={
                actionType === 'REJEITAR' ? 'bg-red-600 hover:bg-red-700' : 
                actionType === 'AGENDAR' ? 'bg-blue-600 hover:bg-blue-700' : 
                'bg-emerald-600 hover:bg-emerald-700'
              }
            >
              {processMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> A processar...</> : 'Confirmar e Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
