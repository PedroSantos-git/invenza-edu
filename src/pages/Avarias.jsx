import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { db } from '@/api/db';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, FileDown, Ban, Copy, ExternalLink, Plus, ArrowUpDown, ArrowUp, ArrowDown, Upload, Loader2, Download, CheckCircle2 } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import SmartScanner from '@/components/shared/SmartScanner';
import AvariaForm from '@/components/avarias/AvariaForm';
import AvariaDetail from '@/components/avarias/AvariaDetail';
import EquipamentoDetail from '@/components/equipamentos/EquipamentoDetail';
import { format, isValid, parse } from 'date-fns';
import { gerarPDFAvaria, gerarRelatorioImportacaoAvariasPDF } from '@/utils/pdfGenerator';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useQueryClient } from '@tanstack/react-query';
import { Progress } from '@/components/ui/progress';

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

const COMPONENTES = [
  { id: 'ecra', label: 'Ecrã' },
  { id: 'disco', label: 'Disco' },
  { id: 'ram', label: 'RAM' },
  { id: 'board', label: 'Board' },
  { id: 'bateria', label: 'Bateria' },
  { id: 'ventoinha', label: 'Ventoinha' },
  { id: 'teclado', label: 'Teclado' },
  { id: 'rato', label: 'Rato' },
  { id: 'carregador', label: 'Carregador' }
];

export default function Avarias() {
  const qc = useQueryClient();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('pendentes');
  const [sort, setSort] = useState({ column: 'created_at', ascending: false });
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importSummary, setImportSummary] = useState(null);
  const fileInputRef = React.useRef(null);

  // Pesquisa de Inutilizados
  const [searchInutilizadosOpen, setSearchInutilizadosOpen] = useState(false);
  const [compFilters, setCompFilters] = useState(
    COMPONENTES.reduce((acc, c) => ({ ...acc, [c.id]: 'indiferente' }), {})
  );
  const [filteredInutilizados, setFilteredInutilizados] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [eqDetailOpen, setEqDetailOpen] = useState(false);
  const [selectedEq, setSelectedEq] = useState(null);

  const { data: avarias = [], isLoading } = useQuery({
    queryKey: ['avarias', sort], queryFn: () => db.entities.Avaria.list(`${sort.ascending ? '' : '-'}${sort.column}`)
  });

  const { data: equipamentos = [] } = useQuery({
    queryKey: ['equipamentos'], queryFn: () => db.entities.Equipamento.list()
  });

  const { data: pdfTemplates = [] } = useQuery({
    queryKey: ['doc-templates'], queryFn: () => db.entities.DocumentoTemplate.list()
  });

  // Handle navigation state to open a specific avaria
  useEffect(() => {
    if (location.state?.selectedAvariaId && avarias.length > 0) {
      const avaria = avarias.find(a => a.id === location.state.selectedAvariaId);
      if (avaria) {
        setSelected(avaria);
        setDetailOpen(true);
        // Clear state to avoid reopening on refresh/back
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, avarias]);

  const handleSort = (column) => {
    setSort(prev => ({
      column,
      ascending: prev.column === column ? !prev.ascending : true
    }));
  };

  const equipamentoById = React.useMemo(
    () => new Map((equipamentos || []).map(eq => [eq.id, eq])),
    [equipamentos]
  );

  const formatEquipamento = (eq) => {
    if (!eq) return '';
    const parts = [eq.tipo, eq.marca, eq.modelo].filter(Boolean);
    return parts.join(' ').trim();
  };

  const avariasDecoradas = (avarias || []).map(a => {
    const eq = equipamentoById.get(a.equipamento_id);
    const equipamentoLabel = formatEquipamento(eq) || a.equipamento_info || a.designacao || '—';
    const equipamentoSn = eq?.numero_serie || a.equipamento_sn || a.numero_serie || '—';
    return { ...a, equipamentoLabel, equipamentoSn };
  });

  const filtered = avariasDecoradas.filter(a => {
    const matchSearch = !search || [
      a.equipamentoLabel,
      a.equipamentoSn,
      a.diagnostico
    ].some(f => f?.toLowerCase().includes(search.toLowerCase()));
    
    let matchEstado = false;
    if (filtroEstado === 'todos') {
      matchEstado = true;
    } else if (filtroEstado === 'pendentes') {
      matchEstado = ['A REVER', 'DIAGNOSTICADO', 'EM REPARAÇÃO', 'AGUARDA PEÇAS'].includes(a.estado);
    } else {
      matchEstado = a.estado === filtroEstado;
    }
    
    return matchSearch && matchEstado;
  });

  const handleSearchInutilizados = () => {
    setIsSearching(true);
    const results = equipamentos.filter(eq => {
      // Regra: pesquisar em todos os estados exceto 'ARRANJADO'
      if (eq.estado === 'ARRANJADO') return false;
      
      // Encontrar todas as avarias deste equipamento, ordenadas pela mais recente
      const eqAvarias = avarias.filter(a => a.equipamento_id === eq.id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      // Se não houver avarias, só passa se todos os filtros forem "indiferente"
      if (eqAvarias.length === 0) {
        return Object.values(compFilters).every(v => v === 'indiferente');
      }

      // Combinar os estados dos componentes de todas as avarias (prioridade para a mais recente)
      const mergedComps = {};
      eqAvarias.forEach(av => {
        if (av.componentes) {
          Object.entries(av.componentes).forEach(([comp, status]) => {
            if (!mergedComps[comp] || mergedComps[comp] === 'DESCONHECIDO') {
              mergedComps[comp] = status;
            }
          });
        }
      });

      // Verificar se o equipamento cumpre todos os critérios de filtro
      return COMPONENTES.every(c => {
        const filter = compFilters[c.id];
        if (filter === 'indiferente') return true;
        const status = mergedComps[c.id] || 'DESCONHECIDO';
        return status === filter;
      });
    });
    setFilteredInutilizados(results);
    setIsSearching(false);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      setImportProgress(0);
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const bstr = event.target.result;
          const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);

          if (data.length === 0) {
            toast.error('O ficheiro está vazio');
            setIsImporting(false);
            return;
          }

          let createdCount = 0;
          let skippedCount = 0;
          let duplicateCount = 0;
          let notFoundEqs = [];
          let successItems = [];
          const avariasToCreate = [];
          const equipmentsToUpdateMap = new Map();

          // Identificar equipamentos que já têm avarias abertas
          const equipamentosComAvariaAberta = new Set(
            avarias
              .filter(a => !['ARRANJADO', 'INUTILIZADO'].includes(a.estado))
              .map(a => a.equipamento_id)
          );

          // Track equipments being added in this batch to prevent internal duplicates
          const equipmentsInCurrentBatch = new Set();

          const mapComponentStatus = (val) => {
            const v = String(val || '').toLowerCase().trim();
            if (v === 'ok') return 'OK';
            if (v === 'x') return 'AVARIADO';
            if (v === '?') return '?';
            return 'DESCONHECIDO';
          };

          for (let i = 0; i < data.length; i++) {
            const row = data[i];
            setImportProgress(Math.round((i / data.length) * 50)); // Primeiros 50% para análise

            // Regra: Não importar se Resolução for ARRANJADO
            const resolucao = String(row['Resolução'] || '').toUpperCase().trim();
            if (resolucao === 'ARRANJADO') {
              skippedCount++;
              continue;
            }

            const sn = row['Nº Série'];
            const imob = row['Nº Imobilizado'];
            
            // Procurar equipamento
            let eq = null;
            if (sn) {
              eq = equipamentos.find(e => String(e.numero_serie || '').trim() === String(sn).trim());
            }
            if (!eq && imob) {
              eq = equipamentos.find(e => String(e.numero_imobilizado || '').trim() === String(imob).trim());
            }

            if (!eq) {
              notFoundEqs.push({
                identificador: sn || imob || 'Desconhecido',
                linha: i + 2,
                motivo: 'Equipamento não encontrado no sistema'
              });
              continue;
            }

            // Regra: Ignorar se já existir avaria aberta para este equipamento (na DB ou neste ficheiro)
            if (equipamentosComAvariaAberta.has(eq.id) || equipmentsInCurrentBatch.has(eq.id)) {
              duplicateCount++;
              
              // Verificar se é o mesmo número de avaria que está a tentar importar (se o #AV existir)
              const numeroAvOriginal = parseInt(row['#AV']);
              const numeroAvaria = isNaN(numeroAvOriginal) ? null : 1000 + numeroAvOriginal;
              
              let motivo = 'Equipamento já tem uma avaria aberta';
              if (numeroAvaria) {
                motivo = `Avaria #${numeroAvaria} já está aberta para ESTE equipamento`;
              }

              notFoundEqs.push({
                identificador: `${eq.numero_serie} (${eq.designacao})`,
                linha: i + 2,
                motivo: motivo
              });
              continue;
            }

            // Marcar como processado neste lote
            equipmentsInCurrentBatch.add(eq.id);

            // Preparar dados da avaria
            let dataAvaria = new Date().toISOString();
            const rawDate = row['Data avaria'];
            
            if (rawDate) {
              const d = new Date(rawDate);
              // Verificar se a data é válida e não é a data base de erro (1970)
              if (isValid(d) && d.getFullYear() > 1975) {
                dataAvaria = d.toISOString();
              }
            }

            const diagInicial = row['Info'] || '';
            const diagResolucao = row['Diagnóstico resolução'] || '';

            const componentes = {
              ecra: mapComponentStatus(row['Ecrã']),
              disco: mapComponentStatus(row['Disco']),
              ram: mapComponentStatus(row['RAM']),
              board: mapComponentStatus(row['Board/gráfica']),
              bateria: mapComponentStatus(row['Bateria']),
              ventoinha: mapComponentStatus(row['Ventoinha'])
            };

            const numeroAvOriginal = parseInt(row['#AV']);
            const numeroAvaria = isNaN(numeroAvOriginal) ? undefined : 1000 + numeroAvOriginal;

            avariasToCreate.push({
              numero_avaria: numeroAvaria,
              equipamento_id: eq.id,
              equipamento_info: `${eq.designacao} (${eq.numero_serie})`,
              created_at: dataAvaria,
              diagnostico: diagInicial,
              resolucao: diagResolucao,
              componentes: componentes,
              estado: 'A REVER',
              origem: 'IMPORTAÇÃO'
            });

            // Adicionar ao mapa para atualização em massa (apenas os campos necessários)
            equipmentsToUpdateMap.set(eq.id, {
              id: eq.id,
              estado: 'Manutenção'
            });
          }

          // Executar criações individualmente para detetar duplicados e gerir erros de forma mais granular
          if (avariasToCreate.length > 0) {
            for (let i = 0; i < avariasToCreate.length; i++) {
              const avaria = avariasToCreate[i];
              setImportProgress(50 + Math.round((i / avariasToCreate.length) * 45)); // Restantes 45% para inserção
              
              try {
                const created = await db.entities.Avaria.create(avaria);
                createdCount++;
                successItems.push({
                  linha: '—', // Poderíamos passar a linha original aqui se quiséssemos ser precisos
                  identificador: avaria.equipamento_info,
                  numero: `#${created.numero_avaria?.toString().padStart(4, '0')}`
                });
              } catch (dbErr) {
                if (dbErr.code === '23505' || dbErr.message?.includes('avarias_numero_avaria_key')) {
                  // Verificar se é o mesmo equipamento
                  const { data: existing } = await db.client
                    .from('avarias')
                    .select('equipamento_id, numero_avaria')
                    .eq('numero_avaria', avaria.numero_avaria)
                    .maybeSingle();

                  const motivo = existing?.equipamento_id === avaria.equipamento_id
                    ? `Nº #${avaria.numero_avaria} já existe para ESTE equipamento`
                    : `Nº #${avaria.numero_avaria} já existe para OUTRO equipamento`;

                  notFoundEqs.push({
                    identificador: avaria.equipamento_info,
                    linha: '—',
                    motivo: motivo
                  });
                } else {
                  console.error('Erro ao criar avaria individual:', dbErr);
                  notFoundEqs.push({
                    identificador: avaria.equipamento_info,
                    linha: '—',
                    motivo: dbErr.message
                  });
                }
              }
            }
          }

          // Executar atualizações de equipamentos em massa (apenas se houver alterações)
          if (equipmentsToUpdateMap.size > 0) {
            setImportProgress(95);
            // IMPORTANTE: bulkUpsert só deve conter os campos a atualizar para evitar erros de NOT NULL
            const updates = Array.from(equipmentsToUpdateMap.values());
            // Usamos update individual para ser mais seguro contra restrições de NOT NULL de outras colunas
            for (const upd of updates) {
              await db.entities.Equipamento.update(upd.id, { estado: upd.estado });
            }
          }

          setImportProgress(100);
          setImportSummary({
            total: data.length,
            created: createdCount,
            skipped: skippedCount,
            duplicates: duplicateCount,
            errors: notFoundEqs,
            successItems: successItems
          });
          
          qc.invalidateQueries({ queryKey: ['avarias'] });
          qc.invalidateQueries({ queryKey: ['equipamentos'] });
        } catch (err) {
          console.error('Erro ao processar ficheiro:', err);
          toast.error('Erro ao processar o conteúdo do ficheiro: ' + err.message);
        } finally {
          setIsImporting(false);
          setImportProgress(0);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };

      reader.readAsBinaryString(file);
    } catch (error) {
      console.error('Erro na importação:', error);
      toast.error('Erro ao importar ficheiro');
      setIsImporting(false);
    }
  };

  const copyToClipboard = (text, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Avarias</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length === (avarias?.length || 0)
              ? `${avarias.filter(a => !['ARRANJADO', 'INUTILIZADO'].includes(a.estado)).length} avaria(s) aberta(s)`
              : `${filtered.length} de ${avarias?.length || 0} avaria(s) (filtrado)`}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            accept=".xlsx, .xls"
            className="hidden"
          />
          <Button 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            {isImporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Importar Excel
          </Button>
          <Button variant="outline" onClick={() => setSearchInutilizadosOpen(true)}>
            <Ban className="w-4 h-4 mr-2" />Pesquisar Inutilizados
          </Button>
          <Button onClick={() => setFormOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />Nova Avaria
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Pesquisar por equipamento, diagnóstico..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <SmartScanner onResult={v => setSearch(v)} label="Pesquisar por scanner" />
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pendentes">Pendentes</SelectItem>
            <SelectItem value="todos">Todos os estados</SelectItem>
            <SelectItem value="A REVER">A Rever</SelectItem>
            <SelectItem value="DIAGNOSTICADO">Diagnosticado</SelectItem>
            <SelectItem value="EM REPARAÇÃO">Em Reparação</SelectItem>
            <SelectItem value="AGUARDA PEÇAS">Aguarda Peças</SelectItem>
            <SelectItem value="ARRANJADO">Arranjado</SelectItem>
            <SelectItem value="INUTILIZADO">Inutilizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-20"><SortButton column="numero_avaria" currentSort={sort} onSort={handleSort} label="Nº" /></TableHead>
              <TableHead><SortButton column="equipamento_info" currentSort={sort} onSort={handleSort} label="Equipamento" /></TableHead>
              <TableHead><SortButton column="equipamento_sn" currentSort={sort} onSort={handleSort} label="Nº Série" /></TableHead>
              <TableHead className="hidden sm:table-cell"><SortButton column="origem" currentSort={sort} onSort={handleSort} label="Origem" /></TableHead>
              <TableHead className="hidden md:table-cell"><SortButton column="diagnostico" currentSort={sort} onSort={handleSort} label="Diagnóstico" /></TableHead>
              <TableHead><SortButton column="estado" currentSort={sort} onSort={handleSort} label="Estado" /></TableHead>
              <TableHead className="hidden sm:table-cell"><SortButton column="created_at" currentSort={sort} onSort={handleSort} label="Data" /></TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">A carregar...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma avaria encontrada</TableCell></TableRow>
            ) : (
              filtered.map(av => (
                <TableRow key={av.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => { setSelected(av); setDetailOpen(true); }}>
                  <TableCell className="font-mono text-xs font-bold text-muted-foreground">
                    #{av.numero_avaria?.toString().padStart(4, '0') || '—'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {av.equipamentoLabel || '—'}
                    {av.equipamento_com_problemas && <span className="ml-2 text-xs text-red-600 font-bold">⚠</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{av.equipamentoSn}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{av.origem}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground truncate max-w-[200px]">{av.diagnostico || '—'}</TableCell>
                  <TableCell><StatusBadge status={av.estado} /></TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">
                    {av.created_at ? format(new Date(av.created_at), 'dd/MM/yyyy') : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); gerarPDFAvaria(av, pdfTemplates); }}><FileDown className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AvariaForm open={formOpen} onClose={() => setFormOpen(false)} />
      {selected && <AvariaDetail open={detailOpen} onClose={() => setDetailOpen(false)} avaria={selected} />}

      {/* Progress Dialog */}
      <Dialog open={isImporting} onOpenChange={() => {}}>
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              A importar avarias...
            </DialogTitle>
            <DialogDescription>Por favor, aguarde enquanto processamos o ficheiro Excel.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Progress value={importProgress} className="h-2" />
            <p className="text-center text-sm font-medium text-muted-foreground">
              {importProgress}% concluído
            </p>
          </div>
        </DialogContent>
      </Dialog>



      {/* Modal Pesquisa Inutilizados */}
      <Dialog open={searchInutilizadosOpen} onOpenChange={setSearchInutilizadosOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-600" />
              Pesquisar Equipamentos Inutilizados
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {COMPONENTES.map(c => (
                  <div key={c.id} className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">{c.label}</Label>
                    <Select 
                      value={compFilters[c.id]} 
                      onValueChange={v => setCompFilters(prev => ({ ...prev, [c.id]: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="indiferente">Indiferente</SelectItem>
                        <SelectItem value="OK">OK</SelectItem>
                        <SelectItem value="AVARIADO">Avariado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end border-t pt-4">
                <Button onClick={handleSearchInutilizados} disabled={isSearching}>
                  <Search className="w-4 h-4 mr-2" />
                  {isSearching ? 'A pesquisar...' : 'Pesquisar'}
                </Button>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Série / Imobilizado</TableHead>
                    <TableHead>Designação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInutilizados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground italic">
                        Nenhum equipamento inutilizado corresponde aos critérios.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInutilizados.map(eq => (
                      <TableRow 
                        key={eq.id} 
                        className="hover:bg-muted/30 cursor-pointer"
                        onClick={() => { setSelectedEq(eq); setEqDetailOpen(true); }}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-mono text-xs font-bold">{eq.numero_serie}</span>
                            <span className="text-[10px] text-muted-foreground">{eq.numero_imobilizado || '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{eq.designacao}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title="Copiar Nº Série"
                              onClick={e => copyToClipboard(eq.numero_serie, e)}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            {eq.numero_imobilizado && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                title="Copiar Imobilizado"
                                onClick={e => copyToClipboard(eq.numero_imobilizado, e)}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="text-[10px] text-muted-foreground text-center">
              A pesquisa mostra equipamentos em qualquer estado (exceto "ARRANJADO") filtrados pelo estado dos seus componentes na última avaria registada.
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedEq && (
        <EquipamentoDetail 
          open={eqDetailOpen} 
          onClose={() => setEqDetailOpen(false)} 
          equipamento={selectedEq}
          isAdmin={true} 
        />
      )}

      {/* Modal Resumo de Importação */}
      <Dialog open={!!importSummary} onOpenChange={() => setImportSummary(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Upload className="w-5 h-5 text-primary" />
              Resumo da Importação
            </DialogTitle>
            <DialogDescription>
              Resultados do processamento do ficheiro de avarias.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-center">
                <p className="text-2xl font-bold text-green-700">{importSummary?.created || 0}</p>
                <p className="text-xs font-medium text-green-600 uppercase tracking-wider">Criadas</p>
              </div>
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-center">
                <p className="text-2xl font-bold text-amber-700">{(importSummary?.duplicates || 0) + (importSummary?.skipped || 0)}</p>
                <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Ignoradas</p>
              </div>
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-center">
                <p className="text-2xl font-bold text-red-700">{importSummary?.errors?.length || 0}</p>
                <p className="text-xs font-medium text-red-600 uppercase tracking-wider">Erros</p>
              </div>
            </div>

            {(importSummary?.duplicates > 0 || importSummary?.skipped > 0) && (
              <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border">
                {importSummary.duplicates > 0 && <p>• {importSummary.duplicates} equipamentos ignorados por já terem avarias abertas.</p>}
                {importSummary.skipped > 0 && <p>• {importSummary.skipped} registos ignorados por já estarem marcados como "ARRANJADO".</p>}
              </div>
            )}

            {importSummary?.errors?.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold text-sm flex items-center gap-2 text-red-700">
                  <Ban className="w-4 h-4" />
                  Equipamentos não encontrados ({importSummary.errors.length})
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 h-10">
                        <TableHead className="text-xs">S/N ou Imobilizado</TableHead>
                        <TableHead className="text-xs w-20 text-center">Linha</TableHead>
                        <TableHead className="text-xs">Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importSummary.errors.map((err, idx) => (
                        <TableRow key={idx} className="h-10">
                          <TableCell className="text-xs font-mono font-bold">{err.identificador}</TableCell>
                          <TableCell className="text-xs text-center text-muted-foreground">{err.linha}</TableCell>
                          <TableCell className="text-xs text-red-600">{err.motivo}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {importSummary?.successItems?.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold text-sm flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  Importados com Sucesso ({importSummary.successItems.length})
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 h-10">
                        <TableHead className="text-xs">Equipamento/SN</TableHead>
                        <TableHead className="text-xs w-24">Nº Avaria</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importSummary.successItems.map((item, idx) => (
                        <TableRow key={idx} className="h-10">
                          <TableCell className="text-xs font-medium">{item.identificador}</TableCell>
                          <TableCell className="text-xs font-mono text-emerald-700">{item.numero}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-muted/30 border-t flex justify-between items-center">
            <Button 
              variant="outline" 
              onClick={() => gerarRelatorioImportacaoAvariasPDF(importSummary)}
              className="text-primary border-primary hover:bg-primary/10"
            >
              <FileDown className="w-4 h-4 mr-2" />
              Imprimir Relatório (PDF)
            </Button>
            <Button onClick={() => setImportSummary(null)}>Fechar Resumo</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
