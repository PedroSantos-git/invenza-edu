import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Pencil, Plus, Trash2, Settings, FileUp, FileDown, Eye, Loader2, Info, Mail, Clock, ShieldCheck, MailPlus, Upload, Image, Database, CheckSquare, Square, RefreshCcw, HardDriveDownload, HardDriveUpload } from 'lucide-react';
import { toast } from 'sonner';
import { DocxProcessor } from '@/utils/docxProcessor';
import mammoth from 'mammoth';
import { saveAs } from 'file-saver';
import RichTextEditor from '@/components/shared/RichTextEditor';
import { EmailService } from '@/api/emailService';
import { useAuth } from '@/lib/AuthContext';
import * as XLSX from 'xlsx';

const TEMPLATE_VARS = {
  EMPRESTIMO_ALUNO: ['{{equipamento}}', '{{pessoa}}', '{{numero_aluno}}', '{{data_emprestimo}}', '{{acessorios}}', '{{notas_entrega}}', '{{data_hoje}}', '{{uuid}}', '{%barcode_serie}', '{%barcode_imobilizado}', '{{kit_count}}', '{{kit_items}}', '{{data_hora}}', '{{ee_nome}}', '{{ee_nif}}', '{{nome_aluno}}', '{{nif_aluno}}', '{{numero_processo_aluno}}', '{{turma_aluno}}', '{{equipamento_secoes}}', '{{equipamento_secao_a}}', '{{equipamento_secao_b}}', '{{cabecalho_entrega}}'],
  EMPRESTIMO_DOCENTE: ['{{equipamento}}', '{{pessoa}}', '{{numero_docente}}', '{{data_emprestimo}}', '{{acessorios}}', '{{notas_entrega}}', '{{data_hoje}}', '{{uuid}}', '{%barcode_serie}', '{%barcode_imobilizado}', '{{kit_count}}', '{{kit_items}}', '{{data_hora}}', '{{nome_docente}}', '{{nif_docente}}', '{{equipamento_secoes}}', '{{equipamento_secao_a}}', '{{equipamento_secao_b}}', '{{cabecalho_entrega}}'],
  DEVOLUCAO_ALUNO: ['{{equipamento}}', '{{pessoa}}', '{{numero_aluno}}', '{{data_devolucao}}', '{{estado_equipamento}}', '{{acessorios_devolvidos}}', '{{notas}}', '{{data_hoje}}', '{{uuid}}', '{%barcode_serie}', '{%barcode_imobilizado}', '{{kit_count}}', '{{kit_items}}', '{{data_hora}}', '{{ee_nome}}', '{{ee_nif}}', '{{nome_aluno}}', '{{nif_aluno}}', '{{numero_processo_aluno}}', '{{turma_aluno}}', '{{equipamento_secoes}}', '{{equipamento_secao_a}}', '{{equipamento_secao_b}}'],
  DEVOLUCAO_DOCENTE: ['{{equipamento}}', '{{pessoa}}', '{{numero_docente}}', '{{data_devolucao}}', '{{estado_equipamento}}', '{{acessorios_devolvidos}}', '{{notas}}', '{{data_hoje}}', '{{uuid}}', '{%barcode_serie}', '{%barcode_imobilizado}', '{{kit_count}}', '{{kit_items}}', '{{data_hora}}', '{{nome_docente}}', '{{nif_docente}}', '{{equipamento_secoes}}', '{{equipamento_secao_a}}', '{{equipamento_secao_b}}'],
  AVARIA: ['{{equipamento}}', '{{pessoa}}', '{{numero_pessoa}}', '{{estado}}', '{{origem}}', '{{diagnostico}}', '{{resolucao}}', '{{componentes}}', '{{data_registo}}', '{{data_resolucao}}', '{{data_hoje}}', '{{uuid}}', '{%barcode_serie}', '{%barcode_imobilizado}', '{{kit_count}}', '{{kit_items}}', '{{data_hora}}', '{{equipamento_secoes}}', '{{equipamento_secao_a}}', '{{equipamento_secao_b}}'],
  EQUIPAMENTO: ['{{designacao}}', '{{numero_serie}}', '{{numero_imobilizado}}', '{{tipo}}', '{{marca}}', '{{modelo}}', '{{estado}}', '{{data_entrada}}', '{{notas}}', '{{data_hoje}}', '{{uuid}}', '{%barcode_serie}', '{%barcode_imobilizado}', '{{kit_count}}', '{{kit_items}}', '{{data_hora}}', '{{equipamento_secoes}}', '{{equipamento_secao_a}}', '{{equipamento_secao_b}}'],
};

const EMAIL_TEMPLATE_VARS = {
  PEDIDO_DOCS_FALTA: ['{{pessoa}}', '{{docs_em_falta}}', '{{horario}}'],
  PEDIDO_AGENDADO: ['{{pessoa}}', '{{data_agendamento}}', '{{horario}}'],
  PEDIDO_REJEITADO: ['{{pessoa}}', '{{motivo_rejeicao}}', '{{horario}}'],
  SUPORTE_INFO: ['{{pessoa}}', '{{info_adicional}}', '{{horario}}'],
  SUPORTE_AGENDADO: ['{{pessoa}}', '{{data_agendamento}}', '{{horario}}'],
  SUPORTE_REJEITADO: ['{{pessoa}}', '{{motivo_rejeicao}}', '{{horario}}'],
  DEVOLUCAO_INFO: ['{{pessoa}}', '{{info_adicional}}', '{{horario}}'],
  DEVOLUCAO_AGENDADA: ['{{pessoa}}', '{{data_agendamento}}', '{{horario}}'],
  DEVOLUCAO_REJEITADA: ['{{pessoa}}', '{{motivo_rejeicao}}', '{{horario}}'],
  SOLICITAR_DEVOLUCAO: ['{{pessoa}}', '{{equipamento}}', '{{motivo}}', '{{horario}}'],
  GERAL: ['{{pessoa}}', '{{corpo}}', '{{horario}}'],
};

const TABLES_CONFIG = [
  { key: 'tipos_equipamento', name: 'Tipos de Equipamento', entity: db.entities.TipoEquipamento },
  { key: 'pessoas', name: 'Pessoas', entity: db.entities.Pessoa },
  { key: 'utilizadores', name: 'Utilizadores', entity: db.entities.User },
  { key: 'equipamentos', name: 'Equipamentos', entity: db.entities.Equipamento },
  { key: 'pedidos', name: 'Pedidos', entity: db.entities.Pedido },
  { key: 'emprestimos', name: 'Empréstimos', entity: db.entities.Emprestimo },
  { key: 'devolucoes', name: 'Devoluções', entity: db.entities.Devolucao },
  { key: 'avarias', name: 'Avarias', entity: db.entities.Avaria },
  { key: 'configuracoes', name: 'Configurações', entity: db.entities.Configuracao },
  { key: 'documento_templates', name: 'Templates de Documentos', entity: db.entities.DocumentoTemplate },
  { key: 'email_templates', name: 'Templates de Email', entity: db.entities.EmailTemplate },
  { key: 'historico_emails', name: 'Histórico de Emails', entity: db.entities.EmailHistorico },
];

function DocxPreview({ base64 }) {
  const [html, setHtml] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!base64) {
      setHtml('');
      return;
    }
    const generatePreview = async () => {
      setLoading(true);
      try {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
        setHtml(result.value);
      } catch (err) {
        console.error('Erro na pré-visualização:', err);
        setHtml('<p class="text-red-500">Erro ao carregar pré-visualização do documento.</p>');
      } finally {
        setLoading(false);
      }
    };
    generatePreview();
  }, [base64]);

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin mr-2" /> A carregar pré-visualização...</div>;
  if (!base64) return null;

  return (
    <div className="border rounded-md p-4 bg-white max-h-[400px] overflow-y-auto prose prose-sm max-w-none shadow-inner" 
         dangerouslySetInnerHTML={{ __html: html }} />
  );
}

export default function Configuracoes() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tipoFormOpen, setTipoFormOpen] = useState(false);
  const [tipoSelected, setTipoSelected] = useState(null);
  const [tipoForm, setTipoForm] = useState({ nome: '', descricao: '' });
  
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [templateSelected, setTemplateSelected] = useState(null);
  const [templateForm, setTemplateForm] = useState({ 
    tipo: 'EMPRESTIMO_ALUNO', 
    titulo: '', 
    conteudo: '', 
    file_base64: null 
  });

  const [emailFormOpen, setEmailFormOpen] = useState(false);
  const [emailSelected, setEmailSelected] = useState(null);
  const [emailForm, setEmailForm] = useState({ tipo: 'GERAL', assunto: '', corpo: '' });

  const [selectedExportTables, setSelectedExportTables] = useState([]);
  const [selectedImportFiles, setSelectedImportFiles] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExportTable = async (tableKey) => {
    const config = TABLES_CONFIG.find(t => t.key === tableKey);
    if (!config) return;
    setIsExporting(true);
    const toastId = toast.loading(`A exportar ${config.name}...`);
    try {
      const data = await config.entity.list();
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, tableKey);
      const fileName = `${tableKey}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success(`${config.name} exportado com sucesso!`, { id: toastId });
    } catch (err) {
      toast.error(`Erro ao exportar: ${err.message}`, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = async () => {
    const tablesToExport = selectedExportTables.length > 0 
      ? TABLES_CONFIG.filter(t => selectedExportTables.includes(t.key)) 
      : TABLES_CONFIG;
    if (tablesToExport.length === 0) {
      toast.warning('Selecione pelo menos uma tabela para exportar.');
      return;
    }
    setIsExporting(true);
    const toastId = toast.loading(`A exportar ${tablesToExport.length} tabela(s)...`);
    try {
      const wb = XLSX.utils.book_new();
      for (const config of tablesToExport) {
        const data = await config.entity.list();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, config.key);
      }
      const fileName = `backup_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success(`${tablesToExport.length} tabela(s) exportada(s) com sucesso!`, { id: toastId });
    } catch (err) {
      toast.error(`Erro ao exportar: ${err.message}`, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    setSelectedImportFiles(prev => [...prev, ...files].filter((f, i, arr) => arr.findIndex(x => x.name === f.name) === i));
  };

  const removeImportFile = (fileName) => {
    setSelectedImportFiles(prev => prev.filter(f => f.name !== fileName));
  };

  const parseExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: 'array' });
          const sheets = {};
          for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(ws, { defval: null });
            sheets[sheetName] = jsonData;
          }
          resolve(sheets);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const deleteAllFromTable = async (tableKey) => {
    const config = TABLES_CONFIG.find(t => t.key === tableKey);
    if (!config) return;
    const data = await config.entity.list();
    for (const item of data) {
      await config.entity.delete(item.id);
    }
  };

  const handleImport = async () => {
    if (selectedImportFiles.length === 0) {
      toast.warning('Selecione pelo menos um ficheiro para importar.');
      return;
    }
    if (!confirm(`Tem a certeza que deseja importar ${selectedImportFiles.length} ficheiro(s)? Esta ação irá substituir os dados das tabelas correspondentes.`)) return;
    setIsImporting(true);
    const toastId = toast.loading('A importar ficheiros...');
    try {
      const allSheets = {};
      for (const file of selectedImportFiles) {
        const sheets = await parseExcelFile(file);
        Object.assign(allSheets, sheets);
      }
      const tablesToProcess = TABLES_CONFIG.filter(t => allSheets[t.key]);
      for (const config of tablesToProcess) {
        toast.loading(`A processar ${config.name}...`, { id: toastId });
        await deleteAllFromTable(config.key);
        const data = allSheets[config.key];
        if (data.length > 0) {
          await config.entity.bulkCreate(data);
        }
      }
      qc.invalidateQueries();
      toast.success(`${tablesToProcess.length} tabela(s) importada(s) com sucesso!`, { id: toastId });
      setSelectedImportFiles([]);
    } catch (err) {
      toast.error(`Erro ao importar: ${err.message}`, { id: toastId });
    } finally {
      setIsImporting(false);
    }
  };

  const { data: configEmail = { dados: {} } } = useQuery({
    queryKey: ['config-email'],
    queryFn: () => db.entities.Configuracao.get('email').catch(() => ({ dados: {} }))
  });
  const { data: configHorario = { dados: { texto: '' } } } = useQuery({
    queryKey: ['config-horario'],
    queryFn: () => db.entities.Configuracao.get('horario').catch(() => ({ dados: { texto: '' } }))
  });
  const { data: emailTemplates = [] } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => db.entities.EmailTemplate.list()
  });
  const { data: tipos = [] } = useQuery({
    queryKey: ['tipos-equipamento'],
    queryFn: () => db.entities.TipoEquipamento.list('-created_date')
  });
  const { data: templates = [] } = useQuery({
    queryKey: ['doc-templates'],
    queryFn: () => db.entities.DocumentoTemplate.list('-created_date')
  });

  const [cleanupFiles, setCleanupFiles] = useState([]);
  const [isCleaning, setIsCleaning] = useState(false);
  const [selectedCleanupKeys, setSelectedCleanupKeys] = useState([]);

  const scanUnusedFiles = async () => {
    setIsCleaning(true);
    const toastId = toast.loading('A analisar ficheiros no S3...');
    try {
      // 1. Obter todos os ficheiros do R2
      const { files } = await db.integrations.Core.ListFiles();
      
      // 2. Obter todas as referências da DB
      const [utilizadores, pessoas, equipamentos, emprestimos, devolucoes, avarias, configs] = await Promise.all([
        db.entities.User.list(),
        db.entities.Pessoa.list(),
        db.entities.Equipamento.list(),
        db.entities.Emprestimo.list(),
        db.entities.Devolucao.list(),
        db.entities.Avaria.list(),
        db.entities.Configuracao.list(),
      ]);

      const allRefs = new Set();
      
      // Extrair URLs de todas as colunas possíveis
      utilizadores.forEach(u => u.foto && allRefs.add(u.foto));
      pessoas.forEach(p => p.foto && allRefs.add(p.foto));
      
      const extractFromDocs = (docs) => {
        if (!docs) return;
        const list = Array.isArray(docs) ? docs : (typeof docs === 'string' ? JSON.parse(docs) : []);
        list.forEach(d => d.url && allRefs.add(d.url));
      };

      equipamentos.forEach(e => extractFromDocs(e.documentos));
      emprestimos.forEach(e => {
        extractFromDocs(e.documentos_entrega);
        extractFromDocs(e.documentos_devolucao);
      });
      devolucoes.forEach(d => extractFromDocs(d.documentos));
      avarias.forEach(a => extractFromDocs(a.documentos));
      
      configs.forEach(c => {
        if (c.id === 'email' && c.dados?.logo_url) allRefs.add(c.dados.logo_url);
      });

      // 3. Filtrar ficheiros que NÃO estão nas referências
      // Ignorar ficheiros que não são URLs completas ou que não pertencem ao nosso R2
      const unused = files.filter(f => !allRefs.has(f.url));
      
      setCleanupFiles(unused);
      setSelectedCleanupKeys([]);
      toast.success(`${unused.length} ficheiros não utilizados encontrados.`, { id: toastId });
    } catch (err) {
      toast.error('Erro ao analisar ficheiros: ' + err.message, { id: toastId });
    } finally {
      setIsCleaning(false);
    }
  };

  const deleteSelectedFiles = async () => {
    if (selectedCleanupKeys.length === 0) return;
    if (!confirm(`Tem a certeza que deseja eliminar ${selectedCleanupKeys.length} ficheiro(s)? Esta ação é irreversível.`)) return;

    setIsCleaning(true);
    const toastId = toast.loading('A eliminar ficheiros...');
    try {
      await db.integrations.Core.DeleteFiles(selectedCleanupKeys);
      toast.success('Ficheiros eliminados com sucesso.', { id: toastId });
      setCleanupFiles(prev => prev.filter(f => !selectedCleanupKeys.includes(f.key)));
      setSelectedCleanupKeys([]);
    } catch (err) {
      toast.error('Erro ao eliminar ficheiros: ' + err.message, { id: toastId });
    } finally {
      setIsCleaning(false);
    }
  };

  const toggleSelectAllCleanup = () => {
    if (selectedCleanupKeys.length === cleanupFiles.length) {
      setSelectedCleanupKeys([]);
    } else {
      setSelectedCleanupKeys(cleanupFiles.map(f => f.key));
    }
  };

  const toggleSelectCleanup = (key) => {
    setSelectedCleanupKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const saveConfigMutation = useMutation({
    mutationFn: ({ id, dados }) => db.entities.Configuracao.upsert({ id, dados }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: [`config-${variables.id}`] });
      toast.success('Configuração guardada');
    }
  });

  const saveEmailTemplateMutation = useMutation({
    mutationFn: (data) => {
      const existing = emailTemplates.find(t => t.tipo === data.tipo && t.id !== emailSelected?.id);
      if (existing) throw new Error(`Já existe um template para o tipo ${data.tipo}.`);
      return emailSelected?.id
        ? db.entities.EmailTemplate.update(emailSelected.id, data)
        : db.entities.EmailTemplate.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-templates'] });
      setEmailFormOpen(false);
      toast.success('Template de email guardado');
    },
    onError: (err) => toast.error(err.message)
  });

  const generateEmailDefaults = async () => {
    const types = Object.keys(EMAIL_TEMPLATE_VARS);
    let added = 0;
    let updated = 0;
    const toastId = toast.loading('A gerar templates base...');
    
    const defaultTemplates = {
      PEDIDO_DOCS_FALTA: {
        assunto: 'Documentos necessários para o seu pedido de equipamento',
        corpo: `
          <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <p>Olá <strong>{{pessoa}}</strong>,</p>
            <p>Para darmos seguimento ao seu pedido de empréstimo, verificámos que ainda necessitamos de alguns documentos adicionais.</p>
            <div style="border-left: 3px solid #e11d48; padding-left: 15px; margin: 20px 0; color: #444;">
              <strong>Documentação pendente:</strong><br/>
              {{docs_em_falta}}
            </div>
            <p>Pode enviar os documentos digitalizados respondendo a este email ou entregá-los pessoalmente nos nossos serviços.</p>
            <p>Obrigado pela sua colaboração.</p>
          </div>
        `
      },
      PEDIDO_AGENDADO: {
        assunto: 'Agendamento para levantamento de equipamento',
        corpo: `
          <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <p>Olá <strong>{{pessoa}}</strong>,</p>
            <p>Gostariamos de informar que o seu pedido de equipamento foi aceite e já se encontra agendado para levantamento.</p>
            <div style="border-left: 3px solid #3b82f6; padding-left: 15px; margin: 20px 0;">
              <strong>Disponível para levantamento a partir de:</strong><br/>
              <span style="font-size: 1.1em; color: #1d4ed8; font-weight: bold;">{{data_agendamento}}</span>
            </div>
            <p>Por favor, dirija-se aos nossos serviços na data indicada ou posterior. Caso não consiga comparecer, agradecemos que nos informe com antecedência.</p>
            <p>Até breve.</p>
          </div>
        `
      },
      PEDIDO_REJEITADO: {
        assunto: 'Ponto de situação do seu pedido de equipamento',
        corpo: `
          <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <p>Olá <strong>{{pessoa}}</strong>,</p>
            <p>Após analisarmos o seu pedido de equipamento, informamos que infelizmente não foi possível satisfazer a sua solicitação neste momento.</p>
            <div style="border-left: 3px solid #64748b; padding-left: 15px; margin: 20px 0; color: #666;">
              <strong>Informação adicional:</strong><br/>
              {{motivo_rejeicao}}
            </div>
            <p>Se tiver alguma dúvida ou necessitar de mais esclarecimentos, estamos inteiramente à sua disposição.</p>
            <p>Melhores cumprimentos.</p>
          </div>
        `
      },
      SUPORTE_INFO: {
        assunto: 'Informação sobre o seu pedido de suporte técnico',
        corpo: `
          <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <p>Olá <strong>{{pessoa}}</strong>,</p>
            <p>No seguimento do seu pedido de suporte, necessitávamos de validar alguns pontos ou que seguisse estas recomendações:</p>
            <div style="border-left: 3px solid #0284c7; padding-left: 15px; margin: 20px 0;">
              <strong>Indicações técnicas:</strong><br/>
              {{info_adicional}}
            </div>
            <p>Ficamos a aguardar as suas notícias para podermos ajudar da melhor forma.</p>
            <p>Obrigado.</p>
          </div>
        `
      },
      SUPORTE_AGENDADO: {
        assunto: 'Agendamento de intervenção técnica',
        corpo: `
          <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <p>Olá <strong>{{pessoa}}</strong>,</p>
            <p>O seu pedido de suporte técnico foi analisado e agendámos uma intervenção presencial para resolver a situação.</p>
            <div style="border-left: 3px solid #d97706; padding-left: 15px; margin: 20px 0;">
              <strong>Intervenção agendada a partir de:</strong><br/>
              <span style="font-size: 1.1em; color: #b45309; font-weight: bold;">{{data_agendamento}}</span>
            </div>
            <p>Por favor, traga o equipamento na data indicada ou posterior aos nossos serviços para que possamos proceder à reparação.</p>
            <p>Até à próxima.</p>
          </div>
        `
      },
      SUPORTE_REJEITADO: {
        assunto: 'Sobre a sua solicitação de suporte técnico',
        corpo: `
          <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <p>Olá <strong>{{pessoa}}</strong>,</p>
            <p>Informamos que não conseguimos processar o seu pedido de suporte técnico da forma solicitada.</p>
            <div style="border-left: 3px solid #64748b; padding-left: 15px; margin: 20px 0; color: #666;">
              <strong>Motivo:</strong><br/>
              {{motivo_rejeicao}}
            </div>
            <p>Pode submeter um novo pedido com mais detalhes ou passar pelos nossos serviços para avaliarmos a situação em conjunto.</p>
            <p>Melhores cumprimentos.</p>
          </div>
        `
      },
      DEVOLUCAO_INFO: {
        assunto: 'Informação sobre a devolução de equipamento',
        corpo: `
          <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <p>Olá <strong>{{pessoa}}</strong>,</p>
            <p>Relativamente à devolução do seu equipamento, necessitamos de partilhar a seguinte informação:</p>
            <div style="border-left: 3px solid #64748b; padding-left: 15px; margin: 20px 0;">
              {{info_adicional}}
            </div>
            <p>Ficamos ao seu dispor para qualquer esclarecimento.</p>
            <p>Obrigado.</p>
          </div>
        `
      },
      DEVOLUCAO_AGENDADA: {
        assunto: 'Confirmação de agendamento de devolução',
        corpo: `
          <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <p>Olá <strong>{{pessoa}}</strong>,</p>
            <p>Confirmamos que o agendamento para a devolução do seu equipamento foi registado.</p>
            <div style="border-left: 3px solid #22c55e; padding-left: 15px; margin: 20px 0;">
              <strong>Entrega prevista a partir de:</strong><br/>
              <span style="font-size: 1.1em; color: #15803d; font-weight: bold;">{{data_agendamento}}</span>
            </div>
            <p>Relembramos que deve trazer todos os acessórios originais (carregadores, cabos, malas, etc.) na data indicada ou posterior.</p>
            <p>Até breve.</p>
          </div>
        `
      },
      DEVOLUCAO_REJEITADA: {
        assunto: 'Ponto de situação do agendamento de devolução',
        corpo: `
          <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <p>Olá <strong>{{pessoa}}</strong>,</p>
            <p>Informamos que não foi possível confirmar o agendamento da sua devolução na data solicitada.</p>
            <div style="border-left: 3px solid #64748b; padding-left: 15px; margin: 20px 0; color: #666;">
              <strong>Motivo:</strong><br/>
              {{motivo_rejeicao}}
            </div>
            <p>Por favor, tente agendar para um novo horário ou contacte-nos diretamente.</p>
            <p>Melhores cumprimentos.</p>
          </div>
        `
      },
      SOLICITAR_DEVOLUCAO: {
        assunto: 'Solicitação de Devolução de Equipamento(s)',
        corpo: `
          <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <p>Olá <strong>{{pessoa}}</strong>,</p>
            <p>Vimos por este meio solicitar a devolução do(s) seguinte(s) equipamento(s) que se encontra(m) em seu poder:</p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin: 15px 0;">
              <strong>{{equipamento}}</strong>
            </div>
            <p><strong>Motivo:</strong> {{motivo}}</p>
            <p>Agradecemos que proceda à entrega do(s) mesmo(s) com a maior brevidade possível.</p>
            <p>Obrigado pela compreensão.</p>
          </div>
        `
      },
      GERAL: {
        assunto: 'Contacto do KIT Informático',
        corpo: `
          <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <p>Olá <strong>{{pessoa}}</strong>,</p>
            <div style="margin: 20px 0;">
              {{corpo}}
            </div>
            <p>Ficamos ao seu dispor para qualquer esclarecimento adicional.</p>
            <p>Atenciosamente.</p>
          </div>
        `
      }
    };
    
    try {
      for (const tipo of types) {
        const existing = emailTemplates.find(t => t.tipo === tipo);
        if (!existing) {
          const template = defaultTemplates[tipo] || {
            assunto: `Notificação de ${tipo.replace(/_/g, ' ').toLowerCase()}`,
            corpo: `<p>Olá <strong>{{pessoa}}</strong>,</p><p>Este é um email automático sobre o seu pedido.</p><p>{{horario}}</p>`
          };
          
          await db.entities.EmailTemplate.create({
            tipo,
            assunto: template.assunto,
            corpo: template.corpo.trim()
          });
          added++;
        } else if ((existing.corpo || '').includes('{{#if') || (existing.corpo || '').includes('{{/if}}') || (existing.corpo || '').includes('{{else}}')) {
          const template = defaultTemplates[tipo] || {
            assunto: existing.assunto || `Notificação de ${tipo.replace(/_/g, ' ').toLowerCase()}`,
            corpo: existing.corpo || `<p>Olá <strong>{{pessoa}}</strong>,</p><p>{{horario}}</p>`
          };
          await db.entities.EmailTemplate.update(existing.id, {
            assunto: template.assunto,
            corpo: template.corpo.trim()
          });
          updated++;
        }
      }
      
      if (added > 0 || updated > 0) {
        await qc.invalidateQueries({ queryKey: ['email-templates'] });
        toast.success(`${added} criado(s), ${updated} atualizado(s)`, { id: toastId });
      } else {
        toast.info('Todos os templates base já existem', { id: toastId });
      }
    } catch (err) {
      toast.error('Erro ao gerar templates: ' + err.message, { id: toastId });
    }
  };

  const testEmailTemplateMutation = useMutation({
    mutationFn: async (template) => {
      if (!user?.email) throw new Error('Sem email do utilizador autenticado.');
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const data = `${dd}/${mm}/${yyyy}`;

      const samples = {
        pessoa: user.full_name || user.email,
        docs_em_falta: '<ul><li>Termo de responsabilidade assinado</li><li>Cópia do documento de identificação</li></ul>',
        data_agendamento: data,
        motivo_rejeicao: 'Exemplo: Documentação incompleta ou indisponibilidade de equipamento.',
        info_adicional: '<p>Exemplo: Reinicie o equipamento e confirme se o problema se mantém. Se possível, envie uma fotografia do erro.</p>',
        equipamento: 'Portátil (S/N ABC123)',
        motivo: '<p>Exemplo: fim do período letivo.</p>',
        corpo: '<p>Este é um email de teste para validar o template e a formatação.</p>'
      };

      await EmailService.sendTemplate({
        tipo: template.tipo,
        to: user.email,
        vars: samples
      });
    },
    onSuccess: () => toast.success('Email de teste enviado.'),
    onError: (err) => toast.error(err.message || 'Erro ao enviar email de teste')
  });

  const openEmailTemplateForm = (t = null) => {
    setEmailSelected(t);
    setEmailForm(t ? { tipo: t.tipo, assunto: t.assunto, corpo: t.corpo } : { tipo: 'GERAL', assunto: '', corpo: '' });
    setEmailFormOpen(true);
  };

  const deleteEmailTemplateMutation = useMutation({
    mutationFn: (id) => db.entities.EmailTemplate.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template removido');
    }
  });

  const saveTipoMutation = useMutation({
    mutationFn: (data) => {
      const existing = tipos.find(t => t.nome.toLowerCase() === data.nome.toLowerCase());
      if (existing) {
        if (existing.ativo === false) return db.entities.TipoEquipamento.update(existing.id, { ...data, ativo: true });
        if (tipoSelected?.id !== existing.id) throw new Error('Já existe um tipo com este nome.');
      }
      return tipoSelected?.id ? db.entities.TipoEquipamento.update(tipoSelected.id, data) : db.entities.TipoEquipamento.create(data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tipos-equipamento'] }); setTipoFormOpen(false); toast.success('Tipo guardado'); },
    onError: (err) => toast.error(err.message || 'Erro ao guardar tipo')
  });

  const reactivateTipoMutation = useMutation({
    mutationFn: (id) => db.entities.TipoEquipamento.update(id, { ativo: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tipos-equipamento'] }); toast.success('Tipo reativado'); }
  });

  const deleteTipoMutation = useMutation({
    mutationFn: (id) => db.entities.TipoEquipamento.update(id, { ativo: false }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tipos-equipamento'] }); toast.success('Tipo desativado'); }
  });

  const saveTemplateMutation = useMutation({
    mutationFn: (data) => {
      const existing = templates.find(t => t.tipo === data.tipo && t.id !== templateSelected?.id && t.ativo !== false);
      if (existing) throw new Error(`Já existe um template ativo para o tipo ${data.tipo}.`);
      const payload = { tipo: data.tipo, titulo: data.titulo, file_base64: data.file_base64, ativo: true };
      return templateSelected?.id ? db.entities.DocumentoTemplate.update(templateSelected.id, payload) : db.entities.DocumentoTemplate.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['doc-templates'] }); setTemplateFormOpen(false); toast.success('Template guardado'); },
    onError: (err) => toast.error(err.message || 'Erro ao guardar template')
  });

  const deleteTemplateMutation = useMutation({
     mutationFn: (id) => db.entities.DocumentoTemplate.delete(id),
     onSuccess: () => { qc.invalidateQueries({ queryKey: ['doc-templates'] }); toast.success('Template eliminado permanentemente'); }
   });

  const openTipoForm = (t = null) => {
    setTipoSelected(t);
    setTipoForm(t ? { nome: t.nome, descricao: t.descricao || '' } : { nome: '', descricao: '' });
    setTipoFormOpen(true);
  };

  const openTemplateForm = (t = null) => {
    setTemplateSelected(t);
    if (t) {
      setTemplateForm({ tipo: t.tipo, titulo: t.titulo, conteudo: t.conteudo || '', file_base64: t.file_base64 });
    } else {
      setTemplateForm({ tipo: 'EMPRESTIMO_ALUNO', titulo: '', conteudo: '', file_base64: null });
    }
    setTemplateFormOpen(true);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const toastId = toast.loading('A processar ficheiro...');
    try {
      const result = await DocxProcessor.parseDocx(file);
      setTemplateForm(prev => ({ ...prev, file_base64: result.base64, conteudo: result.html }));
      toast.success('Documento carregado!', { id: toastId });
    } catch (err) {
      toast.error('Erro ao ler o ficheiro.', { id: toastId });
    } finally {
      e.target.value = '';
    }
  };

  const downloadDocx = () => {
    if (!templateForm.file_base64) return;
    const binaryString = atob(templateForm.file_base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    saveAs(blob, `${templateForm.titulo || 'template'}.docx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
      </div>

      <Tabs defaultValue="tipos" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="tipos">Tipos Equipamento</TabsTrigger>
          <TabsTrigger value="templates">Templates PDF</TabsTrigger>
          <TabsTrigger value="email">Config. Email</TabsTrigger>
          <TabsTrigger value="email-templates">Templates Email</TabsTrigger>
          <TabsTrigger value="horario">Horário</TabsTrigger>
          <TabsTrigger value="cleanup">Limpeza</TabsTrigger>
          <TabsTrigger value="backups">Backups</TabsTrigger>
        </TabsList>

        <TabsContent value="tipos" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{tipos.length} tipo(s) de equipamento</p>
            <Button onClick={() => openTipoForm()} size="sm"><Plus className="w-4 h-4 mr-2" />Novo Tipo</Button>
          </div>
          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-muted/50"><TableHead>Nome</TableHead><TableHead>Descrição</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {tipos.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum tipo configurado.</TableCell></TableRow> :
                  tipos.map(t => (
                    <TableRow key={t.id} className={t.ativo === false ? 'opacity-50 grayscale bg-muted/20' : ''}>
                      <TableCell className="font-medium">{t.nome}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.descricao || '—'}</TableCell>
                      <TableCell>{t.ativo !== false ? <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">ATIVO</span> : <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">INATIVO</span>}</TableCell>
                      <TableCell className="text-right space-x-1">
                        {t.ativo !== false ? <><Button variant="ghost" size="icon" onClick={() => openTipoForm(t)}><Pencil className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => { if (confirm('Desativar este tipo?')) deleteTipoMutation.mutate(t.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button></> :
                        <Button variant="outline" size="sm" onClick={() => reactivateTipoMutation.mutate(t.id)}>Reativar</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Templates DOCX para preenchimento automático.</p>
            <Button onClick={() => openTemplateForm()} size="sm"><Plus className="w-4 h-4 mr-2" />Novo Template</Button>
          </div>
          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-muted/50"><TableHead>Tipo</TableHead><TableHead>Título</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {templates.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Nenhum template PDF.</TableCell></TableRow> :
                  templates.map(t => (
                    <TableRow key={t.id}><TableCell><span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{t.tipo}</span></TableCell><TableCell className="font-medium">{t.titulo}</TableCell>
                      <TableCell className="text-right space-x-1"><Button variant="ghost" size="icon" onClick={() => openTemplateForm(t)}><Pencil className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => { if (confirm('Desativar este template?')) deleteTemplateMutation.mutate(t.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="horario" className="mt-4 space-y-4">
          <Card><CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><Clock className="w-4 h-4" /> Horário de Atendimento</CardTitle><CardDescription>Visível no portal e emails.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <Textarea defaultValue={configHorario.dados.texto || ''} id="horario-texto" placeholder="Ex: Dias úteis das 09:00 às 17:00..." className="min-h-[150px]" />
              <Button onClick={() => saveConfigMutation.mutate({ id: 'horario', dados: { texto: document.getElementById('horario-texto').value } })}>Guardar Horário</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="mt-4 space-y-6">
          <Card><CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><Mail className="w-4 h-4" /> Configuração SMTP</CardTitle><CardDescription>Dados de acesso para o envio de notificações.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Servidor SMTP</Label><Input id="smtp-host" defaultValue={configEmail?.dados?.host || 'smtp.gmail.com'} /></div>
                <div className="space-y-2"><Label>Porta</Label><Input id="smtp-port" defaultValue={configEmail?.dados?.port || '587'} /></div>
                <div className="space-y-2"><Label>Utilizador</Label><Input id="smtp-user" defaultValue={configEmail?.dados?.user || ''} /></div>
                <div className="space-y-2"><Label>App Password</Label><Input id="smtp-pass" defaultValue={configEmail?.dados?.pass || ''} placeholder="Ex: xxxx xxxx xxxx xxxx" /></div>
              </div>
              <Button onClick={() => saveConfigMutation.mutate({ id: 'email', dados: { ...configEmail.dados, host: document.getElementById('smtp-host').value, port: document.getElementById('smtp-port').value, user: document.getElementById('smtp-user').value, pass: document.getElementById('smtp-pass').value } })}>Guardar Configuração</Button>
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><Image className="w-4 h-4" /> Assinatura e Logótipo</CardTitle><CardDescription>Personaliza a imagem e o rodapé de todos os emails.</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Logótipo da Escola</Label>
                <div className="flex items-center gap-6">
                  <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30 overflow-hidden">
                    {configEmail?.dados?.logo_url ? (
                      <img src={configEmail.dados.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <Image className="w-8 h-8 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      type="file"
                      id="logo-upload"
                      className="hidden"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        // Validar tamanho (máx 500kb para Base64 não pesar na DB)
                        if (file.size > 500 * 1024) {
                          toast.error('O ficheiro é demasiado grande (máx 500KB).');
                          return;
                        }

                        const toastId = toast.loading('A carregar logótipo...');
                        try {
                          // Tentar upload normal para R2
                          let finalUrl;
                          try {
                            const { file_url } = await db.integrations.Core.UploadFile({ file, folder: 'config' });
                            finalUrl = file_url;
                          } catch (r2Err) {
                            console.warn('Falha no upload R2, a converter para Base64:', r2Err);
                            // Fallback para Base64 se o R2 falhar (CORS/Permissões)
                            finalUrl = await new Promise((resolve, reject) => {
                              const reader = new FileReader();
                              reader.onload = () => resolve(reader.result);
                              reader.onerror = reject;
                              reader.readAsDataURL(file);
                            });
                          }

                          await saveConfigMutation.mutateAsync({
                            id: 'email',
                            dados: { ...configEmail.dados, logo_url: finalUrl }
                          });
                          toast.success('Logótipo atualizado', { id: toastId });
                        } catch (err) {
                          toast.error('Erro ao guardar imagem: ' + err.message, { id: toastId });
                        }
                      }}
                    />
                    <Button asChild variant="outline" size="sm">
                      <label htmlFor="logo-upload" className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" /> Alterar Logótipo
                      </label>
                    </Button>
                    {configEmail?.dados?.logo_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => saveConfigMutation.mutate({
                          id: 'email',
                          dados: { ...configEmail.dados, logo_url: null }
                        })}
                      >
                        Remover
                      </Button>
                    )}
                    <p className="text-[10px] text-muted-foreground max-w-[200px]">
                      Recomendado: PNG transparente, máx. 500kb.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Rodapé da Assinatura (HTML/Rich Text)</Label>
                <RichTextEditor
                  value={configEmail?.dados?.footer_html || ''}
                  onChange={(content) => {
                    // Nota: Usamos um debounce ou guardamos localmente antes de fazer mutate se necessário
                    // Para simplificar, vamos deixar o utilizador carregar num botão de guardar
                    window._footer_content = content;
                  }}
                  showDocxTools={false}
                  showHelp={false}
                  height={200}
                  menubar={false}
                  toolbar="undo redo | bold italic underline | forecolor | alignleft aligncenter alignright | link | removeformat"
                  plugins={['lists', 'link', 'autolink']}
                />
                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      const content = window._footer_content || configEmail?.dados?.footer_html || '';
                      saveConfigMutation.mutate({
                        id: 'email',
                        dados: { ...configEmail.dados, footer_html: content }
                      });
                    }}
                  >
                    Guardar Rodapé
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email-templates" className="mt-4 space-y-4">
          <div className="flex justify-between items-center"><p className="text-sm text-muted-foreground">Templates de email para notificações.</p>
            <div className="flex gap-2"><Button variant="outline" size="sm" onClick={generateEmailDefaults}><MailPlus className="w-4 h-4 mr-2" />Gerar Base</Button><Button onClick={() => openEmailTemplateForm()} size="sm"><Plus className="w-4 h-4 mr-2" />Novo Template</Button></div>
          </div>
          <div className="rounded-xl border bg-card overflow-hidden">
            <Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Tipo</TableHead><TableHead>Assunto</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {emailTemplates.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Nenhum template.</TableCell></TableRow> :
                  emailTemplates.map(t => (
                    <TableRow key={t.id}><TableCell className="font-bold text-xs">{t.tipo}</TableCell><TableCell className="text-sm">{t.assunto}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testEmailTemplateMutation.mutate(t)}
                          disabled={testEmailTemplateMutation.isPending}
                          title="Envia um email de teste para o teu email"
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Testar
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEmailTemplateForm(t)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm('Apagar template?')) deleteEmailTemplateMutation.mutate(t.id); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="cleanup" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Database className="w-4 h-4" /> Limpeza de Ficheiros (S3/R2)
                  </CardTitle>
                  <CardDescription>
                    Pesquisa ficheiros que já não estão a ser utilizados na base de dados.
                  </CardDescription>
                </div>
                <Button onClick={scanUnusedFiles} disabled={isCleaning} size="sm">
                  {isCleaning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
                  Procurar Não Utilizados
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {cleanupFiles.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-muted/50 p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="sm" onClick={toggleSelectAllCleanup} className="h-8 px-2">
                        {selectedCleanupKeys.length === cleanupFiles.length ? <CheckSquare className="w-4 h-4 mr-2 text-primary" /> : <Square className="w-4 h-4 mr-2" />}
                        Selecionar Todos
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {selectedCleanupKeys.length} de {cleanupFiles.length} selecionados
                      </span>
                    </div>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={deleteSelectedFiles} 
                      disabled={selectedCleanupKeys.length === 0 || isCleaning}
                    >
                      {isCleaning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                      Eliminar Selecionados
                    </Button>
                  </div>

                  <div className="rounded-xl border bg-card overflow-hidden max-h-[500px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead>Nome / Key</TableHead>
                          <TableHead>Tamanho</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cleanupFiles.map(file => (
                          <TableRow key={file.key} className="group">
                            <TableCell>
                              <div className="cursor-pointer" onClick={() => toggleSelectCleanup(file.key)}>
                                {selectedCleanupKeys.includes(file.key) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-[10px] break-all max-w-[300px]">
                              <a href={file.url} target="_blank" rel="noreferrer" className="hover:underline text-primary">
                                {file.key}
                              </a>
                            </TableCell>
                            <TableCell className="text-xs">
                              {(file.size / 1024).toFixed(1)} KB
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(file.lastModified).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                  setSelectedCleanupKeys([file.key]);
                                  deleteSelectedFiles();
                                }}
                                className="h-8 w-8 text-red-500 opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/20">
                  <Database className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Clica em "Procurar Não Utilizados" para analisar o armazenamento.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backups" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <HardDriveDownload className="w-4 h-4" /> Exportar Dados
                </CardTitle>
                <CardDescription>
                  Exporta tabelas para ficheiros Excel.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Tabelas para exportar</Label>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        if (selectedExportTables.length === TABLES_CONFIG.length) {
                          setSelectedExportTables([]);
                        } else {
                          setSelectedExportTables(TABLES_CONFIG.map(t => t.key));
                        }
                      }}
                    >
                      {selectedExportTables.length === TABLES_CONFIG.length ? 'Desselecionar Todos' : 'Selecionar Todos'}
                    </Button>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto border rounded-lg p-3 space-y-2">
                    {TABLES_CONFIG.map(table => (
                      <div key={table.key} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedExportTables.includes(table.key)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedExportTables(prev => [...prev, table.key]);
                            } else {
                              setSelectedExportTables(prev => prev.filter(k => k !== table.key));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <Label className="flex-1 cursor-pointer">{table.name}</Label>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleExportTable(table.key)}
                          disabled={isExporting}
                        >
                          <FileDown className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <Button 
                  onClick={handleExportAll} 
                  disabled={isExporting}
                  className="w-full"
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <HardDriveDownload className="w-4 h-4 mr-2" />}
                  Exportar Selecionadas / Todas
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <HardDriveUpload className="w-4 h-4" /> Importar Dados
                </CardTitle>
                <CardDescription>
                  Importa ficheiros Excel para a base de dados.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Ficheiros para importar</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <input
                      type="file"
                      id="import-files"
                      className="hidden"
                      accept=".xlsx,.xls"
                      multiple
                      onChange={handleFileSelect}
                    />
                    <Button asChild variant="outline">
                      <label htmlFor="import-files" className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        Selecionar Ficheiros
                      </label>
                    </Button>
                  </div>
                </div>
                {selectedImportFiles.length > 0 && (
                  <div className="max-h-[200px] overflow-y-auto border rounded-lg">
                    <Table>
                      <TableBody>
                        {selectedImportFiles.map(file => (
                          <TableRow key={file.name}>
                            <TableCell className="font-medium">{file.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {(file.size / 1024).toFixed(1)} KB
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => removeImportFile(file.name)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <Button 
                  onClick={handleImport} 
                  disabled={selectedImportFiles.length === 0 || isImporting}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <HardDriveUpload className="w-4 h-4 mr-2" />}
                  Importar {selectedImportFiles.length > 0 ? `(${selectedImportFiles.length})` : ''}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <Dialog open={tipoFormOpen} onOpenChange={setTipoFormOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{tipoSelected ? 'Editar Tipo' : 'Novo Tipo'}</DialogTitle>
            <DialogDescription>Define o nome e descrição para a categoria de equipamento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={tipoForm.nome} onChange={e => setTipoForm({...tipoForm, nome: e.target.value})} /></div>
            <div><Label>Descrição</Label><Input value={tipoForm.descricao} onChange={e => setTipoForm({...tipoForm, descricao: e.target.value})} /></div>
            <div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setTipoFormOpen(false)}>Cancelar</Button><Button onClick={() => saveTipoMutation.mutate(tipoForm)} disabled={!tipoForm.nome}>Guardar</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={templateFormOpen} onOpenChange={setTemplateFormOpen}>
        <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{templateSelected?.id ? 'Editar Template' : 'Novo Template'}</DialogTitle>
            <DialogDescription>Configura o template DOCX e as variáveis para geração de documentos PDF.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Tipo</Label><Select value={templateForm.tipo} onValueChange={v => setTemplateForm({...templateForm, tipo: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EMPRESTIMO_ALUNO">Empréstimo (Aluno)</SelectItem><SelectItem value="EMPRESTIMO_DOCENTE">Empréstimo (Docente)</SelectItem><SelectItem value="DEVOLUCAO_ALUNO">Devolução (Aluno)</SelectItem><SelectItem value="DEVOLUCAO_DOCENTE">Devolução (Docente)</SelectItem><SelectItem value="AVARIA">Avaria</SelectItem><SelectItem value="EQUIPAMENTO">Equipamento</SelectItem></SelectContent></Select></div>
              <div><Label>Título *</Label><Input value={templateForm.titulo} onChange={e => setTemplateForm({...templateForm, titulo: e.target.value})} /></div>
            </div>
            <div className="space-y-2"><Label className="flex items-center gap-2"><Info className="w-4 h-4 text-primary" /> Tags Disponíveis</Label>
              <div className="p-3 bg-muted/30 rounded-lg border"><div className="flex flex-wrap gap-1.5">{(TEMPLATE_VARS[templateForm.tipo] || []).map(v => (<code key={v} className="text-[11px] bg-white border border-primary/20 rounded px-2 py-0.5 font-mono text-primary font-medium">{v}</code>))}</div></div>
            </div>
            <div className="space-y-3"><Label>Ficheiro DOCX</Label>
              <div className="flex flex-wrap gap-3 items-center"><input type="file" id="docx-upload" className="hidden" accept=".docx" onChange={handleFileChange} /><Button asChild variant="default" className="bg-blue-600 hover:bg-blue-700"><label htmlFor="docx-upload" className="cursor-pointer"><FileUp className="w-4 h-4 mr-2" /> {templateForm.file_base64 ? 'Substituir' : 'Carregar'}</label></Button>
                {templateForm.file_base64 && <Button type="button" variant="outline" onClick={downloadDocx}><FileDown className="w-4 h-4 mr-2" /> Baixar</Button>}
              </div>
            </div>
            {templateForm.file_base64 && <div className="space-y-2"><Label className="flex items-center gap-2"><Eye className="w-4 h-4" /> Pré-visualização</Label><DocxPreview base64={templateForm.file_base64} /></div>}
            <div className="flex justify-end gap-3 pt-4 border-t"><Button variant="outline" onClick={() => setTemplateFormOpen(false)}>Cancelar</Button><Button onClick={() => saveTemplateMutation.mutate(templateForm)} disabled={!templateForm.titulo || !templateForm.file_base64 || saveTemplateMutation.isPending}>{saveTemplateMutation.isPending ? <Loader2 className="animate-spin" /> : 'Gravar'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={emailFormOpen} onOpenChange={setEmailFormOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{emailSelected ? 'Editar Template Email' : 'Novo Template Email'}</DialogTitle>
            <DialogDescription>Personaliza o assunto e o corpo do email que será enviado automaticamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Tipo Notificação</Label><Select value={emailForm.tipo} onValueChange={v => setEmailForm({...emailForm, tipo: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.keys(EMAIL_TEMPLATE_VARS).map(type => (<SelectItem key={type} value={type}>{type.replace(/_/g, ' ')}</SelectItem>))}</SelectContent></Select></div>
              <div><Label>Assunto</Label><Input value={emailForm.assunto} onChange={e => setEmailForm({...emailForm, assunto: e.target.value})} /></div>
            </div>
            <div className="space-y-2"><Label className="text-xs font-bold flex items-center gap-2"><ShieldCheck className="w-3 h-3 text-primary" /> Tags</Label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30 rounded border">
                {(EMAIL_TEMPLATE_VARS[emailForm.tipo] || []).map(v => (
                  <code
                    key={v}
                    className="text-[10px] bg-white border border-primary/20 rounded px-1.5 py-0.5 font-mono text-primary cursor-pointer hover:bg-primary/5"
                    onClick={() => setEmailForm({ ...emailForm, corpo: `${emailForm.corpo || ''}<p><span>${v}</span></p>` })}
                  >
                    {v}
                  </code>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Corpo do Email</Label>
              <RichTextEditor
                value={emailForm.corpo || ''}
                onChange={(content) => setEmailForm({ ...emailForm, corpo: content })}
                showDocxTools={false}
                showHelp={false}
                height={350}
                menubar={false}
                toolbar="undo redo | blocks | bold italic underline | forecolor backcolor | alignleft aligncenter alignright | bullist numlist | link | removeformat"
                plugins={['lists', 'link', 'table', 'autolink', 'code']}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t"><Button variant="outline" onClick={() => setEmailFormOpen(false)}>Cancelar</Button><Button onClick={() => saveEmailTemplateMutation.mutate(emailForm)} disabled={!emailForm.assunto || !emailForm.corpo}>Gravar</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
