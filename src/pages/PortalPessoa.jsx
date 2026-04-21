import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Monitor, LogOut, ArrowRightLeft, Plus, Calendar, Clock, LifeBuoy, Info } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import { format } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import AppFooter, { PROJECT_NAME } from '@/components/layout/AppFooter';
import { toast } from 'sonner';

export default function PortalPessoa({ user, pessoa }) {
  const qc = useQueryClient();
  const { logout } = useAuth();
  const [suporteDialogOpen, setSuporteDialogOpen] = useState(false);
  const [suporteForm, setSuporteForm] = useState({
    numero_serie: '',
    numero_imobilizado: '',
    descricao_equipamento: '',
    descricao_suporte: ''
  });
  
  const { data: configHorario = { dados: { texto: '' } } } = useQuery({
    queryKey: ['config-horario'],
    queryFn: () => db.entities.Configuracao.get('horario').catch(() => ({ dados: { texto: '' } }))
  });

  const { data: emprestimos = [] } = useQuery({
    queryKey: ['meus-emprestimos', pessoa?.id],
    queryFn: () => db.entities.Emprestimo.filter({ pessoa_id: pessoa.id }, '-created_date'),
    enabled: !!pessoa?.id
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['meus-pedidos', pessoa?.id],
    queryFn: () => db.entities.Pedido.filter({ pessoa_id: pessoa.id }, '-created_at'),
    enabled: !!pessoa?.id
  });

  const createPedidoMutation = useMutation({
    mutationFn: (data) => db.entities.Pedido.create({
      pessoa_id: pessoa.id,
      pessoa_info: pessoa.nome,
      tipo: data.tipo,
      status: 'PENDENTE',
      data_pedido: new Date().toISOString().split('T')[0],
      notas: data.notas || '',
      ...data.camposAdicionais
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meus-pedidos', pessoa?.id] });
      setSuporteDialogOpen(false);
      setSuporteForm({ numero_serie: '', numero_imobilizado: '', descricao_equipamento: '', descricao_suporte: '' });
      toast.success('Pedido enviado com sucesso!');
    },
    onError: (err) => {
      toast.error(err.message || 'Erro ao enviar pedido');
    }
  });

  const ativos = emprestimos.filter(e => e.estado === 'ATIVO');
  const historico = emprestimos.filter(e => e.estado !== 'ATIVO');
  const pedidosPendentes = pedidos.filter(p => !p.resolvido);

  const handleSuporteSubmit = (e) => {
    e.preventDefault();
    if (!suporteForm.descricao_suporte) {
      toast.error('Descreve o problema ou pedido de suporte.');
      return;
    }
    if (!suporteForm.numero_serie && !suporteForm.numero_imobilizado) {
      toast.error('Indica o número de série ou imobilizado.');
      return;
    }
    if (!suporteForm.descricao_equipamento) {
      toast.error('Indica qual é o equipamento.');
      return;
    }

    createPedidoMutation.mutate({
      tipo: 'SUPORTE',
      camposAdicionais: suporteForm
    });
  };

  const handleSuporteComEmprestimo = (emp) => {
    setSuporteForm({
      numero_serie: emp.equipamento_info.match(/\((.*?)\)/)?.[1] || '',
      numero_imobilizado: '',
      descricao_equipamento: emp.equipamento_info.split(' (')[0] || emp.equipamento_info,
      descricao_suporte: ''
    });
    setSuporteDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold">{PROJECT_NAME}</h1>
              <p className="text-[10px] text-muted-foreground">Inventário Escolar Inteligente</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">{pessoa?.nome || user?.full_name}</p>
              <p className="text-xs text-muted-foreground">{pessoa?.tipo} {pessoa?.turma ? `— ${pessoa.turma}` : ''}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 space-y-6 flex-1 w-full">
        {/* Horário de Atendimento */}
        {configHorario.dados.texto && (
          <Card className="bg-primary/5 border-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold flex items-center gap-2 text-primary">
                <Clock className="w-3 h-3" />
                Horário de Atendimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">
                {configHorario.dados.texto}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3">
          <Button 
            variant={ativos.length === 0 ? "default" : "outline"} 
            className="h-20 flex flex-col gap-1 text-[11px] px-2"
            disabled={ativos.length > 0 || createPedidoMutation.isPending || pedidosPendentes.some(p => p.tipo === 'EMPRÉSTIMO')}
            onClick={() => {
              const notas = prompt('Deseja adicionar alguma nota ao pedido de empréstimo?');
              if (notas === null) return; // Utilizador cancelou
              createPedidoMutation.mutate({ tipo: 'EMPRÉSTIMO', notas });
            }}
          >
            <Plus className="w-4 h-4" />
            <span>Pedir Equipamento</span>
          </Button>
          <Button 
            variant={ativos.length > 0 ? "default" : "outline"} 
            className="h-20 flex flex-col gap-1 text-[11px] px-2"
            disabled={ativos.length === 0 || createPedidoMutation.isPending || pedidosPendentes.some(p => p.tipo === 'DEVOLUÇÃO')}
            onClick={() => {
              const notas = prompt('Indique a data/hora preferencial para a devolução:');
              if (notas === null) return; // Utilizador cancelou
              createPedidoMutation.mutate({ tipo: 'DEVOLUÇÃO', notas });
            }}
          >
            <Calendar className="w-4 h-4" />
            <span>Agendar Devolução</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-20 flex flex-col gap-1 text-[11px] px-2 border-primary/20 hover:bg-primary/5"
            disabled={createPedidoMutation.isPending}
            onClick={() => setSuporteDialogOpen(true)}
          >
            <LifeBuoy className="w-4 h-4 text-primary" />
            <span className="text-primary font-medium">Suporte Técnico</span>
          </Button>
        </div>

        {/* Pending requests status */}
        {pedidosPendentes.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/30 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                Pedidos em Processamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pedidosPendentes.map(p => (
                <div key={p.id} className="flex justify-between items-center text-sm p-2 rounded bg-white border shadow-xs">
                  <div>
                    <span className="font-bold uppercase text-[10px] mr-2 text-primary">{p.tipo}</span>
                    <span className="text-muted-foreground text-[10px]">{format(new Date(p.data_pedido), 'dd/MM/yyyy')}</span>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Active loans */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4" />
              Empréstimos Ativos ({ativos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ativos.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Não tem empréstimos ativos.</p>
            ) : (
              <div className="space-y-3">
                {ativos.map(emp => (
                  <div key={emp.id} className="p-4 rounded-xl border bg-blue-50/30 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm">{emp.equipamento_info}</p>
                        <p className="text-[11px] text-muted-foreground">Emprestado em: {format(new Date(emp.data_emprestimo), 'dd/MM/yyyy')}</p>
                      </div>
                      <StatusBadge status={emp.estado} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => handleSuporteComEmprestimo(emp)}>
                        <LifeBuoy className="w-3 h-3 mr-1" /> Suporte p/ este item
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Histórico de Empréstimos</CardTitle>
          </CardHeader>
          <CardContent>
            {historico.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Sem histórico.</p>
            ) : (
              <div className="space-y-2">
                {historico.map(emp => (
                  <div key={emp.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/10">
                    <div>
                      <p className="text-sm font-medium">{emp.equipamento_info}</p>
                      <p className="text-[10px] text-muted-foreground">{format(new Date(emp.data_emprestimo), 'dd/MM/yyyy')}</p>
                    </div>
                    <StatusBadge status={emp.estado} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Personal data */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              Dados Pessoais
              {pessoa?.ee_nome && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold uppercase tracking-wider">Aluno c/ EE</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-[10px] text-muted-foreground uppercase font-bold">Nome</p><p className="font-medium">{pessoa?.nome}</p></div>
              <div><p className="text-[10px] text-muted-foreground uppercase font-bold">Email</p><p className="font-medium truncate">{pessoa?.email || '—'}</p></div>
              <div><p className="text-[10px] text-muted-foreground uppercase font-bold">Tipo</p><p className="font-medium">{pessoa?.tipo}</p></div>
              <div><p className="text-[10px] text-muted-foreground uppercase font-bold">Processo/Nº</p><p className="font-medium">{pessoa?.n_processo || '—'}</p></div>
            </div>
            {pessoa?.ee_nome && (
              <div className="pt-3 border-t space-y-2">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Encarregado de Educação</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-[10px] text-muted-foreground font-bold">Nome</p><p className="font-medium">{pessoa.ee_nome}</p></div>
                  <div><p className="text-[10px] text-muted-foreground font-bold">Telefone</p><p className="font-medium">{pessoa.ee_telefone || '—'}</p></div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Suporte Dialog */}
      <Dialog open={suporteDialogOpen} onOpenChange={setSuporteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-primary" />
              Pedido de Suporte Técnico
            </DialogTitle>
            <DialogDescription>Reporta uma avaria ou solicita auxílio técnico para o teu equipamento.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSuporteSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Equipamento *</Label>
              <Input 
                placeholder="Ex: Portátil Dell Latitude" 
                value={suporteForm.descricao_equipamento}
                onChange={e => setSuporteForm({...suporteForm, descricao_equipamento: e.target.value})}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Nº Série</Label>
                <Input 
                  placeholder="S/N" 
                  value={suporteForm.numero_serie}
                  onChange={e => setSuporteForm({...suporteForm, numero_serie: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Nº Imobilizado</Label>
                <Input 
                  placeholder="Inv #" 
                  value={suporteForm.numero_imobilizado}
                  onChange={e => setSuporteForm({...suporteForm, numero_imobilizado: e.target.value})}
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Info className="w-3 h-3" /> Pelo menos um dos números deve ser preenchido.
            </p>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Descrição da Avaria / Pedido *</Label>
              <Textarea 
                placeholder="Explica o que está a acontecer..." 
                className="min-h-[100px]"
                value={suporteForm.descricao_suporte}
                onChange={e => setSuporteForm({...suporteForm, descricao_suporte: e.target.value})}
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setSuporteDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createPedidoMutation.isPending}>
                {createPedidoMutation.isPending ? 'A enviar...' : 'Enviar Pedido'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AppFooter />
    </div>
  );
}
