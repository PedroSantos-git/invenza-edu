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

export default function DiscrepanciasList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [errorFilter, setErrorFilter] = useState('todos');
  const [selectedKits, setSelectedKits] = useState(new Set());

  const { data: equipments = [], isLoading } = useQuery({
    queryKey: ['equipamentos-all'],
    queryFn: () => db.entities.Equipamento.list()
  });

  const discrepancies = useMemo(() => {
    const allDiscrepancies = findKitDiscrepancies(equipments);
    
    return allDiscrepancies.filter(disc => {
      // Filtro de pesquisa
      const nameMatch = !search || disc.items.some(item => 
        [item.numero_serie, item.numero_imobilizado, item.designacao, item.marca, item.modelo]
          .some(f => f?.toLowerCase().includes(search.toLowerCase()))
      );

      // Filtro de erro
      let errorMatch = true;
      if (errorFilter !== 'todos') {
        if (errorFilter === 'estado') errorMatch = disc.hasEstadoDiff;
        if (errorFilter === 'armazem') errorMatch = disc.hasArmazemDiff;
        
        // Filtros específicos solicitados pelo utilizador
        if (errorFilter === 'emprestado') {
          errorMatch = disc.hasEstadoDiff && disc.items.some(item => ['Aluno', 'Docente'].includes(item.estado));
        }
        if (errorFilter === 'avaria') {
          errorMatch = disc.hasEstadoDiff && disc.items.some(item => item.estado === 'Manutenção');
        }
        if (errorFilter === 'devolvido') {
          errorMatch = disc.hasEstadoDiff && disc.items.some(item => ['Rececionado', 'Recondicionamento'].includes(item.estado));
        }
      }

      return nameMatch && errorMatch;
    });
  }, [equipments, search, errorFilter]);

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
      
      for (const kit of kitsToUpdate) {
        // 1. Determinar o estado de destino
        const targetEstado = sourceItem.estado;
        const targetArmazem = sourceItem.situacao_armazem;

        for (const item of kit.items) {
          if (item.id === sourceItemId) continue;

          // Se o estado for igual, apenas atualizar armazém se necessário
          if (item.estado === targetEstado && item.situacao_armazem === targetArmazem) continue;

          // LOGICA DE SINCRONIZAÇÃO COMPLETA (EMPRESTIMOS, AVARIAS, ETC)
          // Se o estado de destino for Aluno/Docente, precisamos de um empréstimo
          if (['Aluno', 'Docente'].includes(targetEstado)) {
            // Procurar empréstimo ativo do sourceItem
            const { data: activeEmps } = await db.client
              .from('emprestimos')
              .select('*')
              .eq('equipamento_id', sourceItemId)
              .eq('estado', 'ATIVO')
              .limit(1);

            if (activeEmps && activeEmps.length > 0) {
              const sourceEmp = activeEmps[0];
              // Criar empréstimo semelhante para o item atual se não tiver um
              const { data: itemEmps } = await db.client
                .from('emprestimos')
                .select('*')
                .eq('equipamento_id', item.id)
                .eq('estado', 'ATIVO');

              if (!itemEmps || itemEmps.length === 0) {
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

          // Atualizar o equipamento
          await db.entities.Equipamento.update(item.id, {
            estado: targetEstado,
            situacao_armazem: targetArmazem
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipamentos-all'] });
      toast.success("Conjuntos atualizados e registos sincronizados");
      setSelectedKits(new Set());
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
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
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 space-y-2">
          <label className="text-xs font-bold uppercase text-muted-foreground">Pesquisa</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Pesquisar S/N ou Imobilizado..." 
              className="pl-8" 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="w-full md:w-48 space-y-2">
          <label className="text-xs font-bold uppercase text-muted-foreground">Tipo de Erro</label>
          <Select value={errorFilter} onValueChange={setErrorFilter}>
            <SelectTrigger>
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
            onClick={() => handleFixSelected(true)}
            disabled={selectedKits.size === 0 || updateMutation.isPending}
          >
            Seguir Mestres (PC)
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleFixSelected(false)}
            disabled={selectedKits.size === 0 || updateMutation.isPending}
          >
            Seguir Slaves (Hotspot)
          </Button>
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
              <TableHead>Imobilizado</TableHead>
              <TableHead>Equipamentos no Conjunto</TableHead>
              <TableHead>Discrepância Detetada</TableHead>
              <TableHead className="text-right">Ações de Correção</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {discrepancies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-50" />
                  Nenhuma discrepância detetada nos conjuntos.
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
                  <TableCell className="font-bold">{disc.imobilizado}</TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      {disc.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between text-xs p-1 rounded bg-muted/30 border border-transparent hover:border-primary/20 transition-colors">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {isMainEquipment(item) && <Badge variant="outline" className="mr-1 text-[8px] h-3 bg-blue-50 text-blue-700">PC</Badge>}
                              {item.tipo} {item.marca}
                            </span>
                            <span className="text-[10px] text-muted-foreground">S/N: {item.numero_serie}</span>
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
                              Usar este estado
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {disc.hasEstadoDiff && (
                        <Badge variant="destructive" className="text-[10px] w-fit">Estados Diferentes</Badge>
                      )}
                      {disc.hasArmazemDiff && (
                        <Badge variant="destructive" className="text-[10px] w-fit">Armazém Diferente</Badge>
                      )}
                      {disc.items.length > 2 && (
                        <Badge variant="secondary" className="text-[10px] w-fit bg-amber-50 text-amber-700 border-amber-200">Kit Grande ({disc.items.length} itens)</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col gap-1 items-end">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="text-[10px] h-7 w-32"
                        onClick={() => handleFix(disc.kitKey, disc.mainItem.id)}
                      >
                        Seguir Mestre (PC)
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-[10px] h-7 w-32"
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
      <div className="flex justify-between items-center text-xs text-muted-foreground px-1">
        <span>{discrepancies.length} conjuntos com erros detetados.</span>
        {selectedKits.size > 0 && <span>{selectedKits.size} conjuntos selecionados.</span>}
      </div>
    </div>
  );
}
