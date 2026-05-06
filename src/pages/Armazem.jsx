import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, ArrowRight, ArrowLeft, History, Warehouse, Monitor, Loader2, Download, Upload, AlertCircle, Pencil, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import StatusBadge from '@/components/shared/StatusBadge';
import { useAuth } from '@/lib/AuthContext';
import SmartScanner from '@/components/shared/SmartScanner';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import ComponentSelector from '@/components/shared/ComponentSelector';

// Função utilitária para feedback sonoro
const playSound = (type) => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'success') {
      // Som de "OK" - Curto e agudo
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.2);
    } else {
      // Som de "Erro" - Grave e duplo
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
      
      // Segundo bip mais baixo
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(100, audioCtx.currentTime);
        gain2.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.3);
      }, 150);
    }
  } catch (e) {
    console.error('Erro ao tocar som:', e);
  }
};

export default function Armazem() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lastAction, setLastAction] = useState(null);
  const [selectedEq, setSelectedEq] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [searchValue, setSearchValue] = useState({ ENTRY: '', EXIT: '', SEARCH: '', ENTRY_DAMAGE: '' });
  const [searchResults, setSearchResults] = useState([]);
  const [activeField, setActiveField] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSavingAvaria, setIsSavingAvaria] = useState(false);
  const [editingComponents, setEditingComponents] = useState(null);

  const entryRef = useRef(null);
  const entryDamageRef = useRef(null);
  const exitRef = useRef(null);
  const searchRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch all equipment for the autocomplete list
  const { data: allEquipamentos = [], isLoading: isLoadingEqs } = useQuery({
    queryKey: ['equipamentos-armazem-list'],
    queryFn: () => db.entities.Equipamento.list()
  });

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const toExport = allEquipamentos.filter(eq => 
        eq.situacao_armazem === 'Em armazém' || eq.situacao_armazem === 'Fora de armazém'
      );

      if (toExport.length === 0) {
        toast.info('Não existem equipamentos em armazém ou fora de armazém para exportar.');
        return;
      }

      const data = toExport.map(eq => ({
        'S/N': eq.numero_serie || '',
        'Imobilizado': eq.numero_imobilizado || '',
        'Marca': eq.marca || '',
        'Modelo': eq.modelo || '',
        'Situação Armazém': eq.situacao_armazem || ''
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventário Armazém');
      
      const fileName = `Inventario_Armazem_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast.success('Inventário exportado com sucesso');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar inventário');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const bstr = event.target.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);

          if (data.length === 0) {
            toast.error('O ficheiro está vazio');
            return;
          }

          let updatedCount = 0;
          let errorCount = 0;

          for (const row of data) {
            const sn = row['S/N'];
            const imob = row['Imobilizado'];
            const situacao = row['Situação Armazém'];

            if (!situacao || (situacao !== 'Em armazém' && situacao !== 'Fora de armazém')) {
              continue;
            }

            // Procurar equipamento
            let eq = null;
            if (sn) {
              eq = allEquipamentos.find(e => e.numero_serie === String(sn));
            }
            if (!eq && imob) {
              eq = allEquipamentos.find(e => e.numero_imobilizado === String(imob));
            }

            if (eq) {
              // Só atualizar se a situação mudou
              if (eq.situacao_armazem !== situacao) {
                const historyEntry = {
                  data: new Date().toISOString(),
                  tipo: situacao === 'Em armazém' ? 'ENTRADA' : 'SAÍDA',
                  utilizador: `${user?.full_name || user?.email || 'Sistema'} (Importação)`
                };

                await db.entities.Equipamento.update(eq.id, {
                  situacao_armazem: situacao,
                  historico_armazem: [historyEntry, ...(eq.historico_armazem || [])]
                });
                updatedCount++;
              }
            } else {
              errorCount++;
            }
          }

          toast.success(`Importação concluída: ${updatedCount} atualizados.`);
          if (errorCount > 0) {
            toast.warning(`${errorCount} equipamentos não encontrados no sistema.`);
          }
          
          qc.invalidateQueries({ queryKey: ['equipamentos'] });
          qc.invalidateQueries({ queryKey: ['equipamentos-armazem-list'] });
        } catch (err) {
          console.error('Erro ao processar ficheiro:', err);
          toast.error('Erro ao processar o conteúdo do ficheiro');
        } finally {
          setIsImporting(false);
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

  // Filter results based on search value and active field
  useEffect(() => {
    const currentSearch = activeField ? searchValue[activeField] : '';
    
    if (!activeField || !currentSearch || currentSearch.length < 2) {
      setSearchResults(prev => prev.length > 0 ? [] : prev);
      return;
    }

    const term = currentSearch.toLowerCase();
    const filtered = allEquipamentos
      .filter(eq => 
        (eq.numero_serie?.toLowerCase().includes(term)) || 
        (eq.numero_imobilizado?.toLowerCase().includes(term)) ||
        (eq.marca?.toLowerCase().includes(term)) ||
        (eq.modelo?.toLowerCase().includes(term))
      )
      .slice(0, 5);

    // Only update if results actually changed to avoid infinite loops
    setSearchResults(prev => {
      if (prev.length === filtered.length && prev.every((val, index) => val.id === filtered[index].id)) {
        return prev;
      }
      return filtered;
    });
  }, [searchValue.ENTRY, searchValue.EXIT, searchValue.SEARCH, searchValue.ENTRY_DAMAGE, activeField, allEquipamentos]);

  const handleAction = useCallback(async (value, actionType) => {
    const cleanValue = value?.trim();
    if (!cleanValue) return;

    try {
      console.log(`Executando ação ${actionType} para: ${cleanValue}`);
      setNotFound(false);
      
      let eq = null;
      // 1. Procurar por Número de Série (Insensível a maiúsculas/minúsculas)
      const { data: eqsBySerie } = await db.client
        .from('equipamentos')
        .select('*')
        .ilike('numero_serie', cleanValue)
        .limit(1);

      if (eqsBySerie && eqsBySerie.length > 0) {
        eq = eqsBySerie[0];
      } else {
        // 2. Procurar por Número de Imobilizado (Insensível a maiúsculas/minúsculas)
        const { data: eqsByImob } = await db.client
          .from('equipamentos')
          .select('*')
          .ilike('numero_imobilizado', cleanValue)
          .limit(1);
          
        if (eqsByImob && eqsByImob.length > 0) {
          eq = eqsByImob[0];
        }
      }

      if (!eq) {
        setNotFound(true);
        setSelectedEq(null);
        setLastAction(null);
        toast.error('Equipamento não encontrado');
        playSound('error');
        
        // Selecionar o texto mesmo se não for encontrado
        const ref = actionType === 'ENTRY' ? entryRef : actionType === 'EXIT' ? exitRef : searchRef;
        if (ref.current) {
          ref.current.select();
        }
        return;
      }

      // Limpar resultados de pesquisa
      setSearchResults([]);
      playSound('success');

      if (actionType === 'SEARCH') {
        setSelectedEq(eq);
        setLastAction({ type: 'PESQUISA', eq });
        
        // Selecionar o texto após a ação
        const ref = actionType === 'ENTRY' ? entryRef : actionType === 'EXIT' ? exitRef : searchRef;
        if (ref.current) {
          ref.current.select();
        }
        return;
      }

      // Lógica de Entrada/Saída
      const newSituacao = actionType === 'EXIT' ? 'Fora de armazém' : 'Em armazém';
      const alreadyInState = eq.situacao_armazem === newSituacao;
      let avariaCriada = null;
      
      // Lógica especial para Entrada com Avaria
      if (actionType === 'ENTRY_DAMAGE') {
        // Verificar se existe avaria aberta
        const { data: avariasAbertas } = await db.client
          .from('avarias')
          .select('*')
          .eq('equipamento_id', eq.id)
          .not('estado', 'in', '("ARRANJADO","INUTILIZADO")');

        if (avariasAbertas && avariasAbertas.length > 0) {
          console.log('Equipamento já tem avaria aberta. Fazendo apenas entrada.');
          avariaCriada = avariasAbertas[0];
          if (!alreadyInState) {
            toast.info('Equipamento já possui uma avaria ativa. Entrada registada.');
          }
        } else {
          console.log('Criando nova avaria para entrada com danos.');
          const eqNome = `${eq.tipo} ${eq.marca} ${eq.modelo}`.trim() || eq.designacao;
          
          // Obter o próximo número de avaria (max + 1)
          const { data: maxAvaria } = await db.client
            .from('avarias')
            .select('numero_avaria')
            .order('numero_avaria', { ascending: false })
            .limit(1)
            .maybeSingle();

          const nextNumero = maxAvaria?.numero_avaria ? maxAvaria.numero_avaria + 1 : 1001;

          avariaCriada = await db.entities.Avaria.create({
            numero_avaria: nextNumero,
            equipamento_id: eq.id,
            equipamento_info: eqNome,
            origem: 'DIRETA',
            estado: 'A REVER',
            diagnostico: 'A rever....',
            componentes: { 
              ecra: 'DESCONHECIDO', disco: 'DESCONHECIDO', ram: 'DESCONHECIDO',
              board: 'DESCONHECIDO', bateria: 'DESCONHECIDO', ventoinha: 'DESCONHECIDO',
              teclado: 'DESCONHECIDO', touchpad: 'DESCONHECIDO'
            },
            historico_estados: [{
              tipo: 'estado',
              estado_novo: 'A REVER',
              data: new Date().toISOString(),
              utilizador: user?.full_name || user?.email || 'Sistema (Armazém)'
            }]
          });
          toast.warning(`Nova avaria #${avariaCriada.numero_avaria} aberta.`);
        }
      }

      console.log(`Atualizando equipamento ${eq.id} para ${newSituacao}`);

      // Se for entrada com avaria, o estado do equipamento passa a Manutenção (se não estiver já)
      const updatePayload = {
        situacao_armazem: newSituacao
      };

      if (!alreadyInState) {
        const historyEntry = {
          data: new Date().toISOString(),
          tipo: actionType === 'EXIT' ? 'SAÍDA' : 'ENTRADA',
          utilizador: user?.full_name || user?.email || 'Sistema'
        };
        updatePayload.historico_armazem = [historyEntry, ...(eq.historico_armazem || [])];
      }

      if (actionType === 'ENTRY_DAMAGE') {
        updatePayload.estado = 'Manutenção';
      }

      // Atualizar na base de dados
      const updatedData = await db.entities.Equipamento.update(eq.id, updatePayload);

      if (updatedData) {
        setLastAction({ 
          type: actionType === 'EXIT' ? 'SAÍDA' : (actionType === 'ENTRY_DAMAGE' ? 'ENTRADA_AVARIA' : 'ENTRADA'), 
          eq: updatedData,
          avaria: avariaCriada
        });
        setSelectedEq(updatedData);
        
        // Inicializar componentes para edição se for entrada com avaria
        if (actionType === 'ENTRY_DAMAGE' && avariaCriada) {
          setEditingComponents(avariaCriada.componentes || {});
        } else {
          setEditingComponents(null);
        }
        
        if (actionType === 'EXIT') {
          toast.success(alreadyInState ? 'Equipamento já se encontra fora de armazém' : 'Saída registada com sucesso');
        } else if (actionType === 'ENTRY') {
          toast.success(alreadyInState ? 'Equipamento já se encontra em armazém' : 'Entrada registada com sucesso');
        }
      }

      // Selecionar o texto após a ação (em vez de limpar)
      const refMap = { ENTRY: entryRef, ENTRY_DAMAGE: entryDamageRef, EXIT: exitRef, SEARCH: searchRef };
      const ref = refMap[actionType];
      if (ref?.current) {
        ref.current.select();
      }
      
      // Invalidar queries para atualizar listas em outros locais
      qc.invalidateQueries({ queryKey: ['equipamentos'] });
    } catch (error) {
      console.error('Erro na ação de armazém:', error);
      toast.error('Erro ao processar ação no armazém');
    }
  }, [user, qc]);

  const handleSaveComponents = async () => {
    if (!lastAction?.avaria?.id || !editingComponents) return;
    
    try {
      setIsSavingAvaria(true);
      await db.entities.Avaria.update(lastAction.avaria.id, {
        componentes: editingComponents
      });
      
      // Atualizar o lastAction com os novos componentes
      setLastAction(prev => ({
        ...prev,
        avaria: { ...prev.avaria, componentes: editingComponents }
      }));
      
      toast.success('Componentes atualizados com sucesso');
    } catch (error) {
      console.error('Erro ao guardar componentes:', error);
      toast.error('Erro ao guardar componentes');
    } finally {
      setIsSavingAvaria(false);
    }
  };

  const handleSelectResult = (eq, actionType) => {
    // Definir o valor e fechar a lista
    setSearchValue(prev => ({ ...prev, [actionType]: eq.numero_serie }));
    setSearchResults([]);
    
    // Devolver o foco para o input
    const ref = actionType === 'ENTRY' ? entryRef : actionType === 'EXIT' ? exitRef : searchRef;
    if (ref.current) {
      ref.current.focus();
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Armazém</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Controlo de entradas e saídas de equipamentos do armazém físico.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLoadingEqs || isExporting || isImporting ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImport}
                accept=".xlsx, .xls, .csv"
                className="hidden"
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Importar
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExport}
                disabled={isExporting}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Exportar
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SearchField 
          actionType="ENTRY"
          icon={ArrowRight}
          label="Entrada em Armazém"
          colorClass="bg-green-50/30"
          borderClass="border-green-200"
          ringClass="focus-visible:ring-green-500"
          inputRef={entryRef}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          activeField={activeField}
          setActiveField={setActiveField}
          searchResults={searchResults}
          handleAction={handleAction}
          handleSelectResult={handleSelectResult}
        />

        <SearchField 
          actionType="ENTRY_DAMAGE"
          icon={AlertCircle}
          label="Entrada com Avaria"
          colorClass="bg-red-50/30"
          borderClass="border-red-200"
          ringClass="focus-visible:ring-red-500"
          inputRef={entryDamageRef}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          activeField={activeField}
          setActiveField={setActiveField}
          searchResults={searchResults}
          handleAction={handleAction}
          handleSelectResult={handleSelectResult}
        />

        <SearchField 
          actionType="EXIT"
          icon={ArrowLeft}
          label="Saída de Armazém"
          colorClass="bg-amber-50/30"
          borderClass="border-amber-200"
          ringClass="focus-visible:ring-amber-500"
          inputRef={exitRef}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          activeField={activeField}
          setActiveField={setActiveField}
          searchResults={searchResults}
          handleAction={handleAction}
          handleSelectResult={handleSelectResult}
        />

        <SearchField 
          actionType="SEARCH"
          icon={Search}
          label="Apenas Pesquisar"
          colorClass="bg-slate-50/30"
          borderClass="border-slate-200"
          ringClass="focus-visible:ring-slate-500"
          inputRef={searchRef}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          activeField={activeField}
          setActiveField={setActiveField}
          searchResults={searchResults}
          handleAction={handleAction}
          handleSelectResult={handleSelectResult}
        />
      </div>

      {selectedEq && (
        <div className={`grid grid-cols-1 ${lastAction?.type === 'ENTRADA_AVARIA' ? 'lg:grid-cols-3' : 'md:grid-cols-2'} gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 p-6 rounded-xl transition-colors ${
          lastAction?.type === 'ENTRADA' ? 'bg-green-100/50' : 
          lastAction?.type === 'ENTRADA_AVARIA' ? 'bg-red-100/50' :
          lastAction?.type === 'SAÍDA' ? 'bg-red-100/50' : 
          ''
        }`}>
          <Card className={
            lastAction?.type === 'ENTRADA' ? 'border-green-200 shadow-sm' : 
            lastAction?.type === 'ENTRADA_AVARIA' ? 'border-red-300 shadow-md ring-2 ring-red-200' :
            lastAction?.type === 'SAÍDA' ? 'border-red-200 shadow-sm' : 
            ''
          }>
            <CardHeader className="pb-3 border-b">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-primary" /> 
                  Informação do Equipamento
                </CardTitle>
                {lastAction && lastAction.type !== 'PESQUISA' && (
                  <Badge className={
                    lastAction.type === 'ENTRADA' ? 'bg-green-600 text-white border-green-700' : 
                    lastAction.type === 'ENTRADA_AVARIA' ? 'bg-red-700 text-white border-red-800 animate-pulse' :
                    'bg-red-600 text-white border-red-700'
                  }>
                    {lastAction.type === 'ENTRADA' ? 'Entrada Registada' : 
                     lastAction.type === 'ENTRADA_AVARIA' ? 'Entrada COM AVARIA' :
                     'Saída Registada'}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {lastAction?.type === 'ENTRADA_AVARIA' && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 mb-4 animate-in zoom-in-95 duration-300">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold uppercase">Atenção: Equipamento com Danos</p>
                    <p className="text-[11px]">Uma nova avaria foi registada e o estado do equipamento foi alterado para Manutenção.</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Designação</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedEq.designacao}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedEq.tipo}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nº Série</p>
                  <p className="text-sm font-mono font-bold text-primary">{selectedEq.numero_serie}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nº Imobilizado</p>
                  <p className="text-sm font-bold text-slate-700">{selectedEq.numero_imobilizado || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estado Atual</p>
                  <div className="mt-1"><StatusBadge status={selectedEq.estado} /></div>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Situação Armazém</p>
                  <div className="mt-1">
                    <Badge variant="outline" className={
                      selectedEq.situacao_armazem === 'Em armazém' ? 'border-green-500 text-green-700 bg-green-50' : 
                      selectedEq.situacao_armazem === 'Fora de armazém' ? 'border-amber-500 text-amber-700 bg-amber-50' : 
                      'border-slate-300 text-slate-500 bg-slate-50'
                    }>
                      {selectedEq.situacao_armazem || 'Desconhecido'}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Marca / Modelo</p>
                <p className="text-sm text-slate-700">{[selectedEq.marca, selectedEq.modelo].filter(Boolean).join(' ') || '—'}</p>
              </div>
            </CardContent>
          </Card>

          {lastAction?.type === 'ENTRADA_AVARIA' && lastAction.avaria && (
            <Card className="border-red-300 shadow-md">
              <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" /> 
                  Detalhes da Avaria
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-primary gap-1"
                  onClick={() => navigate('/avarias', { state: { selectedAvariaId: lastAction.avaria.id } })}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Editar
                </Button>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nº Avaria</p>
                    <p className="text-4xl font-black text-red-600">
                      #{lastAction.avaria.numero_avaria?.toString().padStart(4, '0')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Estado</p>
                    <StatusBadge status={lastAction.avaria.estado} />
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Componentes</p>
                  <div className="bg-white p-3 rounded-lg border border-red-100">
                    <ComponentSelector 
                      componentes={editingComponents || {}} 
                      onChange={setEditingComponents} 
                    />
                  </div>
                  <Button 
                    className="w-full gap-2" 
                    onClick={handleSaveComponents}
                    disabled={isSavingAvaria}
                  >
                    {isSavingAvaria ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                    Gravar Componentes
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className={
            lastAction?.type === 'ENTRADA' ? 'border-green-200 shadow-sm' : 
            lastAction?.type === 'SAÍDA' ? 'border-red-200 shadow-sm' : 
            ''
          }>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-primary" /> 
                Histórico de Armazém
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[300px]">
                {selectedEq.historico_armazem && selectedEq.historico_armazem.length > 0 ? (
                  <div className="divide-y">
                    {selectedEq.historico_armazem.map((entry, idx) => (
                      <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${entry.tipo === 'ENTRADA' ? 'bg-green-100' : 'bg-amber-100'}`}>
                            {entry.tipo === 'ENTRADA' ? <ArrowRight className={`w-4 h-4 ${entry.tipo === 'ENTRADA' ? 'text-green-600' : 'text-amber-600'}`} /> : <ArrowLeft className="w-4 h-4 text-amber-600" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{entry.tipo}</p>
                            <p className="text-[11px] text-slate-500">{entry.utilizador}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-medium text-slate-700">
                            {format(new Date(entry.data), "dd 'de' MMMM 'de' yyyy", { locale: pt })}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {format(new Date(entry.data), "HH:mm")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground p-6 text-center">
                    <History className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-sm">Sem histórico registado para este equipamento.</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {!selectedEq && !notFound && (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl bg-slate-50/50 text-muted-foreground">
          <Warehouse className="w-12 h-12 mb-4 opacity-20" />
          <h3 className="text-lg font-medium text-slate-900">Nenhum equipamento selecionado</h3>
          <p className="text-sm max-w-xs text-center mt-1">
            Utilize os campos acima para ler um código de barras ou pesquisar um equipamento.
          </p>
        </div>
      )}

      {notFound && (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl bg-red-50 border-red-200 text-red-600 animate-in zoom-in-95 duration-300">
          <Search className="w-12 h-12 mb-4 opacity-40" />
          <h3 className="text-lg font-bold">Equipamento não encontrado</h3>
          <p className="text-sm max-w-xs text-center mt-1 text-red-500">
            O número de série ou imobilizado introduzido não existe no sistema.
          </p>
        </div>
      )}
    </div>
  );
}

const SearchField = ({ 
  icon: Icon, 
  label, 
  colorClass, 
  borderClass, 
  ringClass, 
  inputRef, 
  actionType,
  searchValue,
  setSearchValue,
  activeField,
  setActiveField,
  searchResults,
  handleAction,
  handleSelectResult
}) => (
  <Card className={`relative ${borderClass} ${colorClass}`}>
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between">
        <CardTitle className={`text-sm font-medium flex items-center gap-2 ${colorClass.replace('bg-', 'text-').replace('/30', '')}`}>
          <Icon className="w-4 h-4" /> {label}
        </CardTitle>
        <SmartScanner onResult={(val) => {
          setSearchValue(prev => ({ ...prev, [actionType]: val }));
          handleAction(val, actionType);
        }} />
      </div>
    </CardHeader>
    <CardContent className="relative">
      <Input 
        ref={inputRef}
        value={searchValue[actionType]}
        onChange={(e) => {
          setSearchValue(prev => ({ ...prev, [actionType]: e.target.value }));
          if (activeField !== actionType) setActiveField(actionType);
        }}
        onFocus={(e) => {
          if (activeField !== actionType) setActiveField(actionType);
          e.target.select();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAction(searchValue[actionType], actionType);
          }
        }}
        placeholder="S/N ou Imobilizado..." 
        className={`bg-white ${borderClass} ${ringClass}`}
      />
      <p className={`text-[10px] ${colorClass.replace('bg-', 'text-').replace('/30', '')} mt-2 font-medium`}>
        Pressione Enter para {label.toLowerCase().includes('pesquisar') ? 'consultar' : label.toLowerCase()}
      </p>

      {/* Lista de Sugestões */}
      {activeField === actionType && searchResults.length > 0 && (
        <div className="absolute z-50 left-6 right-6 top-[60px] bg-white border rounded-md shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-1">
            {searchResults.map((eq) => (
              <button
                key={eq.id}
                type="button"
                tabIndex={-1}
                // O uso de onMouseDown com preventDefault impede que o input perca o foco
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectResult(eq, actionType);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 rounded-sm flex flex-col gap-0.5 outline-none"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-primary">{eq.numero_serie}</span>
                  <Badge variant="outline" className="text-[10px] h-4">{eq.tipo}</Badge>
                </div>
                <div className="text-[11px] text-slate-500 flex justify-between">
                  <span>{eq.marca} {eq.modelo}</span>
                  {eq.numero_imobilizado && <span>Imob: {eq.numero_imobilizado}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </CardContent>
  </Card>
);
