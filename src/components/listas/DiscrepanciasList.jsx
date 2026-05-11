import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { findKitDiscrepancies, isMainEquipment } from '@/utils/kitUtils';
import { 
  Search, 
  Filter, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  RefreshCw,
  MoreVertical,
  CheckSquare,
  Square
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import StatusBadge from '@/components/shared/StatusBadge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';

export default function DiscrepanciasList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [errorFilter, setErrorFilter] = useState('todos');
  const [mestreEstadoFilter, setMestreEstadoFilter] = useState('todos');
  const [slaveEstadoFilter, setSlaveEstadoFilter] = useState('todos');
  const [mestreArmazemFilter, setMestreArmazemFilter] = useState('todos');
  const [slaveArmazemFilter, setSlaveArmazemFilter] = useState('todos');
  const [sortConfig, setSortConfig] = useState({ key: 'items_count', direction: 'desc' });
  const [selectedKits, setSelectedKits] = useState(new Set());
  
  // Estados para barra de progresso
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const { data: equipments = [], isLoading } = useQuery({
    queryKey: ['equipamentos-all'],
    queryFn: () => db.entities.Equipamento.list()
  });

  const discrepancies = useMemo(() => {
    let allDiscrepancies = findKitDiscrepancies(equipments);
    
    // Aplicar Filtros
    allDiscrepancies = allDiscrepancies.filter(disc => {
      // 1. Pesquisa
      const nameMatch = !search || disc.items.some(item => 
        [item.numero_serie, item.numero_imobilizado, item.designacao, item.marca, item.modelo]
          .some(f => f?.toLowerCase().includes(search.toLowerCase()))
      );

      // 2. Filtro de Erro (Antigo)
      let errorMatch = true;
      if (errorFilter !== 'todos') {
        if (errorFilter === 'estado') errorMatch = disc.hasEstadoDiff;
        if (errorFilter === 'armazem') errorMatch = disc.hasArmazemDiff;
        if (errorFilter === 'emprestado') errorMatch = disc.hasEstadoDiff && disc.items.some(item => ['Aluno', 'Docente'].includes(item.estado));
        if (errorFilter === 'avaria') errorMatch = disc.hasEstadoDiff && disc.items.some(item => item.estado === 'Manutenção');
        if (errorFilter === 'devolvido') errorMatch = disc.hasEstadoDiff && disc.items.some(item => ['Rececionado', 'Recondicionamento'].includes(item.estado));
      }

      // 3. Novos Filtros Avançados
      const mestreMatch = mestreEstadoFilter === 'todos' || disc.mainItem.estado === mestreEstadoFilter;
      const slaveMatch = slaveEstadoFilter === 'todos' || disc.slaveItem.estado === slaveEstadoFilter;
      const mestreArmMatch = mestreArmazemFilter === 'todos' || disc.mainItem.situacao_armazem === mestreArmazemFilter;
      const slaveArmMatch = slaveArmazemFilter === 'todos' || disc.slaveItem.situacao_armazem === slaveArmazemFilter;

      return nameMatch && errorMatch && mestreMatch && slaveMatch && mestreArmMatch && slaveArmMatch;
    });

    // Aplicar Ordenação
    return [...allDiscrepancies].sort((a, b) => {
      let valA, valB;
      
      switch (sortConfig.key) {
        case 'mestre_estado': valA = a.mainItem.estado; valB = b.mainItem.estado; break;
        case 'slave_estado': valA = a.slaveItem.estado; valB = b.slaveItem.estado; break;
        case 'mestre_armazem': valA = a.mainItem.situacao_armazem; valB = b.mainItem.situacao_armazem; break;
        case 'slave_armazem': valA = a.slaveItem.situacao_armazem; valB = b.slaveItem.situacao_armazem; break;
        case 'items_count': valA = a.items.length; valB = b.items.length; break;
        default: valA = a.imobilizado; valB = b.imobilizado;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [equipments, search, errorFilter, mestreEstadoFilter, slaveEstadoFilter, mestreArmazemFilter, slaveArmazemFilter, sortConfig]);

  const toggleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const toggleSelectAll = () => {
    if (selectedKits.size === discrepancies.length) {
      setSelectedKits(new Set());
    } else {
      setSelectedKits(new Set(discrepancies.map(d => d.kitKey)));
    }
  };

  const toggleSelectKit = (kitKey) => {
    const newSelected = new Set(selectedKits);
    if (newSelected.has(kitKey)) {
      newSelected.delete(kitKey);
    } else {
      newSelected.add(kitKey);
    }
    setSelectedKits(newSelected);
  };

  const updateMutation = useMutation({
    mutationFn: async ({ kitKeys, sourceItemId }) => {
      const sourceItem = equipments.find(e => e.id === sourceItemId);
      if (!sourceItem) throw new Error("Item de origem não encontrado");

      const kitsToUpdate = discrepancies.filter(d => kitKeys.has(d.kitKey));
      const totalSteps = kitsToUpdate.reduce((acc, kit) => acc + kit.items.length - 1, 0);
      let currentStep = 0;

      setIsProcessing(true);
      setProgress(0);
      
      for (const kit of kitsToUpdate) {
        setStatusMessage(`A processar conjunto ${kit.imobilizado}...`);
        
        // 1. Determinar o estado de destino
        const targetEstado = sourceItem.estado;
        const targetArmazem = sourceItem.situacao_armazem;

        for (const item of kit.items) {
          if (item.id === sourceItemId) continue;
          
          currentStep++;
          setProgress(Math.round((currentStep / totalSteps) * 100));
          setStatusMessage(`A sincronizar ${item.tipo} (${item.numero_serie})...`);

          // Se o estado for igual, apenas atualizar armazém se necessário
          if (item.estado === targetEstado && item.situacao_armazem === targetArmazem) continue;

          // Atualizar o equipamento para o estado de destino (ou intermédio se necessário)
          // Se o equipamento estiver 'Inutilizado' ou 'Extraviado', movemos para 'Recondicionamento'
          // primeiro para permitir que os triggers de Empréstimo/Avaria funcionem.
          if (['Inutilizado', 'Extraviado'].includes(item.estado)) {
            await db.entities.Equipamento.update(item.id, { estado: 'Recondicionamento' });
          }

          // LOGICA DE SINCRONIZAÇÃO COMPLETA (EMPRESTIMOS, AVARIAS, ETC)
          // Se o estado de destino for Aluno/Docente, precisamos de um empréstimo
          if (['Aluno', 'Docente'].includes(targetEstado)) {
            const { data: activeEmps } = await db.client
              .from('emprestimos')
              .select('*')
              .eq('equipamento_id', sourceItemId)
              .eq('estado', 'ATIVO')
              .limit(1);

            if (activeEmps && activeEmps.length > 0) {
              const sourceEmp = activeEmps[0];
              const { data: itemEmps } = await db.client
                .from('emprestimos')
                .select('*')
                .eq('equipamento_id', item.id)
                .eq('estado', 'ATIVO');

              if (!itemEmps || itemEmps.length === 0) {
                setStatusMessage(`A criar empréstimo para ${item.numero_serie}...`);
                // Forçar estado disponível antes de criar empréstimo para passar no trigger
                await db.entities.Equipamento.update(item.id, { estado: 'Recondicionamento' });
                
                await db.entities.Emprestimo.create({
                  equipamento_id: item.id,
                  pessoa_id: sourceEmp.pessoa_id,
                  equipamento_info: `${item.tipo} ${item.marca} ${item.modelo}`.trim(),
                  pessoa_info: sourceEmp.pessoa_info,
                  data_emprestimo: sourceEmp.data_emprestimo,
                  estado: 'ATIVO',
                  notas_entrega: `Sincronização automática via Auditoria (Imob: ${kit.imobilizado})`
                });
              }
            }
          }

          // Se o estado de destino for Manutenção, precisamos de uma avaria
          if (targetEstado === 'Manutenção') {
            const { data: activeAvarias } = await db.client
              .from('avarias')
              .select('*')
              .eq('equipamento_id', sourceItemId)
              .not('estado', 'in', '("ARRANJADO","INUTILIZADO")')
              .limit(1);

            if (activeAvarias && activeAvarias.length > 0) {
              const sourceAv = activeAvarias[0];
              const { data: itemAvarias } = await db.client
                .from('avarias')
                .select('*')
                .eq('equipamento_id', item.id)
                .not('estado', 'in', '("ARRANJADO","INUTILIZADO")');

              if (!itemAvarias || itemAvarias.length === 0) {
                setStatusMessage(`A abrir avaria para ${item.numero_serie}...`);
                const { data: maxAvaria } = await db.client
                  .from('avarias')
                  .select('numero_avaria')
                  .order('numero_avaria', { ascending: false })
                  .limit(1)
                  .maybeSingle();

                const nextNumero = maxAvaria?.numero_avaria ? maxAvaria.numero_avaria + 1 : 1001;

                await db.entities.Avaria.create({
                  numero_avaria: nextNumero,
                  equipamento_id: item.id,
                  equipamento_info: `${item.tipo} ${item.marca} ${item.modelo}`.trim(),
                  origem: sourceAv.origem || 'AUDITORIA',
                  estado: sourceAv.estado || 'A REVER',
                  diagnostico: `Sincronização automática via Auditoria (Imob: ${kit.imobilizado})`,
                  componentes: sourceAv.componentes || {}
                });
              }
            }
          }

          // Atualização final do equipamento (estado e armazém)
          await db.entities.Equipamento.update(item.id, {
            estado: targetEstado,
            situacao_armazem: targetArmazem
          });
        }
      }
      
      setStatusMessage('Finalizando atualizações...');
      await new Promise(resolve => setTimeout(resolve, 500));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipamentos-all'] });
      toast.success("Conjuntos atualizados e registos sincronizados");
      setSelectedKits(new Set());
      setIsProcessing(false);
      setProgress(0);
      setStatusMessage('');
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
      setIsProcessing(false);
    }
  });

  const handleFix = (kitKey, sourceItemId) => {
    updateMutation.mutate({ kitKeys: new Set([kitKey]), sourceItemId });
  };

  const handleFixSelected = (useMainItem = true) => {
    if (selectedKits.size === 0) {
      toast.error("Selecione pelo menos um conjunto");
      return;
    }
    
    toast.promise(
      (async () => {
        for (const kitKey of selectedKits) {
          const disc = discrepancies.find(d => d.kitKey === kitKey);
          const sourceItem = useMainItem ? disc.mainItem : disc.slaveItem;
          await updateMutation.mutateAsync({ kitKeys: new Set([kitKey]), sourceItemId: sourceItem.id });
        }
      })(),
      {
        loading: 'A atualizar e sincronizar conjuntos...',
        success: 'Operação concluída com sucesso',
        error: 'Erro ao processar alguns conjuntos'
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary mb-2" />
        <p className="text-sm text-muted-foreground">A analisar base de dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de Progresso de Processamento */}
      {isProcessing && (
        <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border rounded-lg p-6 shadow-lg space-y-4 animate-in fade-in zoom-in duration-300">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-primary" />
              Processando Sincronização...
            </h3>
            <span className="text-xs font-mono font-bold text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground animate-pulse">{statusMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end bg-muted/20 p-4 rounded-lg border">
        <div className="space-y-2 lg:col-span-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Pesquisa</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Pesquisar S/N ou Imobilizado..." 
              className="pl-8 h-9" 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Tipo de Erro</label>
          <Select value={errorFilter} onValueChange={setErrorFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Erros</SelectItem>
              <SelectItem value="emprestado">Erro: Emprestado</SelectItem>
              <SelectItem value="avaria">Erro: Avaria</SelectItem>
              <SelectItem value="devolvido">Erro: Devolvido</SelectItem>
              <SelectItem value="armazem">Erro: Armazém</SelectItem>
              <SelectItem value="estado">Outros erros de Estado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            className="flex-1 h-9 text-xs font-bold bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
            onClick={() => handleFixSelected(true)}
            disabled={selectedKits.size === 0 || updateMutation.isPending}
          >
            Seguir Mestres (PC)
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            className="flex-1 h-9 text-xs font-bold bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
            onClick={() => handleFixSelected(false)}
            disabled={selectedKits.size === 0 || updateMutation.isPending}
          >
            Seguir Slaves
          </Button>
        </div>

        {/* Novos Filtros de Estado */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Estado Mestre</label>
          <Select value={mestreEstadoFilter} onValueChange={setMestreEstadoFilter}>
            <SelectTrigger className="h-8 text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {['Aluno', 'Docente', 'Escola', 'Manutenção', 'Rececionado', 'Recondicionamento', 'Substituido', 'Extraviado', 'Inutilizado'].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Estado Slave</label>
          <Select value={slaveEstadoFilter} onValueChange={setSlaveEstadoFilter}>
            <SelectTrigger className="h-8 text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {['Aluno', 'Docente', 'Escola', 'Manutenção', 'Rececionado', 'Recondicionamento', 'Substituido', 'Extraviado', 'Inutilizado'].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Armazém Mestre</label>
          <Select value={mestreArmazemFilter} onValueChange={setMestreArmazemFilter}>
            <SelectTrigger className="h-8 text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="Em armazém">Em armazém</SelectItem>
              <SelectItem value="Fora de armazém">Fora de armazém</SelectItem>
              <SelectItem value="Desconhecido">Desconhecido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Armazém Slave</label>
          <Select value={slaveArmazemFilter} onValueChange={setSlaveArmazemFilter}>
            <SelectTrigger className="h-8 text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="Em armazém">Em armazém</SelectItem>
              <SelectItem value="Fora de armazém">Fora de armazém</SelectItem>
              <SelectItem value="Desconhecido">Desconhecido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">
                <Checkbox 
                  checked={selectedKits.size === discrepancies.length && discrepancies.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="cursor-pointer select-none text-[10px] uppercase font-bold" onClick={() => toggleSort('imobilizado')}>
                Imobilizado {sortConfig.key === 'imobilizado' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead className="text-[10px] uppercase font-bold">Equipamentos no Conjunto</TableHead>
              <TableHead className="text-[10px] uppercase font-bold">Resumo Estados (Mestre vs Slave)</TableHead>
              <TableHead className="text-right text-[10px] uppercase font-bold">Ações de Correção</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {discrepancies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-50" />
                  Nenhuma discrepância detetada com os filtros atuais.
                </TableCell>
              </TableRow>
            ) : (
              discrepancies.map((disc) => (
                <TableRow key={disc.kitKey} className="hover:bg-muted/10">
                  <TableCell>
                    <Checkbox 
                      checked={selectedKits.has(disc.kitKey)}
                      onCheckedChange={() => toggleSelectKit(disc.kitKey)}
                    />
                  </TableCell>
                  <TableCell className="font-bold text-sm">{disc.imobilizado}</TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      {disc.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between text-xs p-1 rounded bg-muted/30 border border-transparent hover:border-primary/20 transition-colors">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {isMainEquipment(item) && <Badge variant="outline" className="mr-1 text-[8px] h-3 bg-blue-50 text-blue-700">MESTRE</Badge>}
                              {!isMainEquipment(item) && item.tipo?.toUpperCase().includes('HOTSPOT') && <Badge variant="outline" className="mr-1 text-[8px] h-3 bg-amber-50 text-amber-700">SLAVE</Badge>}
                              {item.tipo} {item.marca}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">S/N: {item.numero_serie}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={item.estado} className="scale-75 origin-right" />
                            <Badge variant="outline" className="text-[8px] h-4">{item.situacao_armazem}</Badge>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 px-1 text-[8px] hover:bg-primary/10 hover:text-primary"
                              onClick={() => handleFix(disc.kitKey, item.id)}
                            >
                              Usar este
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="flex flex-col border-r pr-2">
                          <span className="text-muted-foreground font-bold mb-1">Mestre:</span>
                          <StatusBadge status={disc.mainItem.estado} className="scale-75 origin-left" />
                          <span className="mt-1 opacity-70">{disc.mainItem.situacao_armazem}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-muted-foreground font-bold mb-1">Slave:</span>
                          <StatusBadge status={disc.slaveItem.estado} className="scale-75 origin-left" />
                          <span className="mt-1 opacity-70">{disc.slaveItem.situacao_armazem}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-1">
                        {disc.hasEstadoDiff && <Badge variant="destructive" className="text-[8px] h-4">Estado ≠</Badge>}
                        {disc.hasArmazemDiff && <Badge variant="destructive" className="text-[8px] h-4">Armazém ≠</Badge>}
                        {disc.items.length > 2 && <Badge variant="secondary" className="text-[8px] h-4 bg-amber-100 text-amber-800 border-amber-200">KIT +{disc.items.length}</Badge>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col gap-1 items-end">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="text-[10px] h-7 w-32 font-bold bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                        onClick={() => handleFix(disc.kitKey, disc.mainItem.id)}
                      >
                        Seguir Mestre (PC)
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-[10px] h-7 w-32 font-bold bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                        onClick={() => handleFix(disc.kitKey, disc.slaveItem.id)}
                      >
                        Seguir Slave
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-between items-center text-xs text-muted-foreground px-1 bg-muted/10 p-2 rounded">
        <span>{discrepancies.length} conjuntos com discrepâncias encontradas.</span>
        {selectedKits.size > 0 && <span className="font-bold text-primary">{selectedKits.size} conjuntos selecionados para correção em bloco.</span>}
      </div>
    </div>
  );
}
