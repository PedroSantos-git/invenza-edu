import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { DocxProcessor } from './docxProcessor';
import { saveAs } from 'file-saver';
import { db } from '@/api/db';

const ACESSORIOS_LABELS = {
  carregador: 'Carregador portátil',
  rato: 'Rato',
  hotspot: 'Hotspot',
  cartao_internet: 'Cartão internet',
  mala: 'Mala',
  auscultadores: 'Auscultadores',
  pen: 'Pen'
};

function formatDate(d) {
  if (!d) return '—';
  try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return d; }
}

function formatAcessorios(obj = {}) {
  return Object.entries(ACESSORIOS_LABELS)
    .filter(([k]) => obj[k])
    .map(([, v]) => v)
    .join(', ') || 'Nenhum';
}

function formatDataHora() {
  const now = new Date();
  const dia = now.getDate().toString().padStart(2, '0');
  const mes = (now.getMonth() + 1).toString().padStart(2, '0');
  const ano = now.getFullYear();
  const horas = now.getHours().toString().padStart(2, '0');
  const minutos = now.getMinutes().toString().padStart(2, '0');
  return `${dia}   /  ${mes}  /  ${ano} , às  ${horas}  horas  ${minutos}  minutos`;
}

function generateEquipmentSections(kitItems) {
  const sections = [];
  let sectionLetter = 'A';
  
  const pcs = kitItems.filter(item => item.tipo?.toUpperCase().startsWith('PC'));
  const hotspots = kitItems.filter(item => item.tipo?.toUpperCase().includes('HOTSPOT'));
  const others = kitItems.filter(item => !pcs.includes(item) && !hotspots.includes(item));
  
  if (pcs.length > 0) {
    const pc = pcs[0];
    sections.push({
      letter: sectionLetter++,
      title: 'Computador',
      items: pcs,
      content: `
a) \t Computador ${pc.tipo || 'PC'}:


\t N.º de série do computador n.º ${pc.numero_serie || '—'}; 
\t N.º de imobilizado do computador n.º ${pc.numero_imobilizado || '—'}; 
\t Mochila; 
\t Transformador; 
\t Auscultador com microfone (Headset). 
`
    });
  }
  
  if (hotspots.length > 0) {
    const hotspot = hotspots[0];
    sections.push({
      letter: sectionLetter++,
      title: 'Conetividade Hotspot',
      items: hotspots,
      content: `
b) \t Conetividade Hotspot:


  N.º de série/ID n.º ${hotspot.numero_serie || '—'}; 
\t SIM Card - cartão SIM n.º (Por Atribuir); 
  
\t Caraterísticas da conetividade: 

i. \t Plafond de 12 GBytes/mensais, sem restrições de acessos ou débito; 
ii. \t Débito garantido igual ou superior a 2 Mbps; 
iii. \t Avisos ao utilizador (SMS) a 80% e 100% do consumo do plafond de 12 Gbytes/mensais referido na alínea i.; 
iv. \t Uma vez esgotado o plafond referido na alínea i. será aplicada uma limitação do débito, respeitando o estabelecido na alínea ii. de 2 Mbps; 
v. \t Capacidade de utilização das redes 2G, 3G e 4G; 
vi. \t Uma vez esgotado o plafond referido na alínea i., o utilizador pode proceder à aquisição de tráfego adicional, em múltiplos de 2GBytes, pelo preço unitário de € 5,00 (cinco euros), com IVA incluído, através de Multibanco, Home banking ou MB Way, aplicando-se à prestação desse serviço, pelo menos, as mesmas condições técnicas previstas; 
vii. \t Está vedada a possibilidade de realização de comunicações de voz; 
viii. \t Está vedada a realização de comunicações em roaming fora da UE. 
`
    });
  }
  
  return sections;
}

/**
 * Main export function: Prioritizes DOCX substitution, falls back to HTML-to-PDF
 */
async function exportDocument(title, template, vars) {
  // Generate barcodes if missing but text exists
  if (vars.numero_serie && !vars.barcode_serie) {
    vars.barcode_serie = await DocxProcessor.generateBarcode(vars.numero_serie);
  }
  if (vars.numero_imobilizado && !vars.barcode_imobilizado) {
    vars.barcode_imobilizado = await DocxProcessor.generateBarcode(vars.numero_imobilizado);
  }

  if (template?.file_base64) {
    try {
      // 1. Generate filled DOCX
      const docxBlob = await DocxProcessor.generateDocx(template.file_base64, vars);
      
      // 2. Offer DOCX download
      saveAs(docxBlob, `${title.replace(/\s+/g, '_')}.docx`);
      
      // 3. Also generate PDF for convenience (from the HTML preview)
      if (template.conteudo) {
        const filledHtml = fillHtmlVariables(template.conteudo, vars);
        await DocxProcessor.htmlToPdf(filledHtml, `${title.replace(/\s+/g, '_')}.pdf`);
      }
      return;
    } catch (err) {
      console.error('DOCX Export failed, falling back to PDF:', err);
    }
  }

  // Fallback: Original HTML to PDF logic
  if (template?.conteudo) {
    const filledHtml = fillHtmlVariables(template.conteudo, vars);
    await DocxProcessor.htmlToPdf(filledHtml, `${title.replace(/\s+/g, '_')}.pdf`);
  }
}

function fillHtmlVariables(html, vars) {
  let content = html;
  Object.entries(vars).forEach(([key, value]) => {
    // Skip objects/images for HTML replacement for now
    if (typeof value === 'string' || typeof value === 'number') {
      let displayValue = value;
      if (typeof value === 'string' && value.startsWith('BOLD:')) {
        displayValue = `<strong>${value.replace('BOLD:', '')}</strong>`;
      }
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), displayValue ?? '—');
    }
  });
  return content;
}

export async function gerarPDFEmprestimo(emprestimo, templates = [], currentUser = null) {
  // Fetch full data if needed
  const pessoa = await db.entities.Pessoa.get(emprestimo.pessoa_id);
  const eq = await db.entities.Equipamento.get(emprestimo.equipamento_id);
  
  // Fetch all kit items
  let kitItems = [eq];
  if (eq?.numero_imobilizado?.trim()) {
    const { data: siblings } = await db.client
      .from('equipamentos')
      .select('*')
      .eq('numero_imobilizado', eq.numero_imobilizado.trim())
      .neq('id', eq.id);
    if (siblings && siblings.length > 0) {
      kitItems = [eq, ...siblings];
    }
  }
  
  // Prepare kit variables
  const kitCount = kitItems.length;
  const kitItemsStr = kitItems
    .map(item => `${item.tipo || 'Equipamento'} - ${item.numero_serie || '—'}`)
    .join('\n');
  
  // Prepare structured equipment sections
  const equipmentSections = generateEquipmentSections(kitItems);
  
  const isAluno = pessoa?.tipo === 'Aluno';
  const templateType = isAluno ? 'EMPRESTIMO_ALUNO' : 'EMPRESTIMO_DOCENTE';
  const template = templates.find(t => t.tipo === templateType && t.ativo !== false) || templates.find(t => t.tipo === 'EMPRESTIMO');

  // Generate header section
  let cabecalhoEntrega = '';
  if (isAluno) {
    cabecalhoEntrega = `
Auto de Entrega nº ${emprestimo.id}

No dia ${formatDataHora().split(' às ')[0]}, às ${formatDataHora().split(' às ')[1]}, na Escola Secundária D. João II, Setúbal, sita na R. Dr. Luís Macedo e Castro 2914-510 SETÚBAL procedeu-se à entrega temporária e gratuita dos bens e equipamentos informáticos, abaixo descritos a:

${pessoa?.ee_nome || '—'}, Encarregado de Educação, com o NIF ${pessoa?.ee_nif || '—'}, do aluno ${pessoa?.nome || '—'}, nº de processo ${pessoa?.n_processo || '—'} matriculado na Escola Secundária D. João II, Setúbal, a frequentar o ${pessoa?.turma || '—'} ano, com o NIF ${pessoa?.nif || '—'}.
`;
  } else {
    cabecalhoEntrega = `
Auto de Entrega: nº ${emprestimo.id}


No dia ${formatDataHora().split(' às ')[0]}, às ${formatDataHora().split(' às ')[1]}, na Escola Secundária D. João II, Setúbal, sita na R. Dr. Luís Macedo e Castro 2914-510 SETÚBAL procedeu-se à entrega temporária e gratuita dos bens e equipamentos informáticos, abaixo descritos a:


${pessoa?.nome || '—'}, Docente, do grupo de recrutamento ${pessoa?.grupo_recrutamento || '—'}, do QE ${pessoa?.qe || '—'}, ${pessoa?.email || '—'}, a exercer funções letivas no Escola Secundária D. João II, Setúbal, e residente em ${pessoa?.morada || '—'}, com o NIF ${pessoa?.nif || '—'}, titular do Cartão de Cidadão n.º ${pessoa?.cc_numero || '—'}.
`;
  }
  
  const vars = {
    equipamento: eq?.designacao || emprestimo.equipamento_info || '—',
    pessoa: pessoa?.nome || emprestimo.pessoa_info || '—',
    numero_aluno: isAluno ? (pessoa?.nif || '—') : '—',
    numero_docente: !isAluno ? (pessoa?.nif || '—') : '—',
    data_emprestimo: formatDate(emprestimo.data_emprestimo),
    notas_entrega: emprestimo.notas_entrega || '—',
    acessorios: formatAcessorios(emprestimo.acessorios_entregues),
    data_hoje: formatDate(new Date()),
    uuid: emprestimo.id,
    numero_serie: eq?.numero_serie || '—',
    numero_imobilizado: eq?.numero_imobilizado || '—',
    kit_count: kitCount,
    kit_items: kitItemsStr,
    
    // New variables
    data_hora: formatDataHora(),
    ee_nome: pessoa?.ee_nome || '—',
    ee_nif: pessoa?.ee_nif || '—',
    nome_aluno: isAluno ? pessoa?.nome : '—',
    nif_aluno: isAluno ? pessoa?.nif : '—',
    numero_processo_aluno: isAluno ? pessoa?.n_processo : '—',
    turma_aluno: isAluno ? pessoa?.turma : '—',
    nome_docente: !isAluno ? pessoa?.nome : '—',
    nif_docente: !isAluno ? pessoa?.nif : '—',
    cabecalho_entrega: cabecalhoEntrega,
    utilizador_atual: currentUser?.full_name || '—',
    
    // Docente-specific variables
    docente_grupo_recrutamento: pessoa?.grupo_recrutamento || '—',
    docente_qe: pessoa?.qe || '—',
    docente_cc_numero: pessoa?.cc_numero || '—',
    
    // Equipment section variables
    equipamento_secoes: equipmentSections.map(s => s.content).join(''),
    equipamento_secao_a: equipmentSections.find(s => s.letter === 'A')?.content || '',
    equipamento_secao_b: equipmentSections.find(s => s.letter === 'B')?.content || ''
  };

  await exportDocument(`Emprestimo_${isAluno ? 'Aluno' : 'Docente'}`, template, vars);
}

export async function gerarPDFDevolucao(devolucao, templates = [], currentUser = null) {
  const emp = await db.entities.Emprestimo.get(devolucao.emprestimo_id);
  const pessoa = await db.entities.Pessoa.get(emp?.pessoa_id);
  const eq = await db.entities.Equipamento.get(emp?.equipamento_id);
  
  // Fetch all kit items
  let kitItems = [eq];
  if (eq?.numero_imobilizado?.trim()) {
    const { data: siblings } = await db.client
      .from('equipamentos')
      .select('*')
      .eq('numero_imobilizado', eq.numero_imobilizado.trim())
      .neq('id', eq.id);
    if (siblings && siblings.length > 0) {
      kitItems = [eq, ...siblings];
    }
  }
  
  // Prepare kit variables
  const kitCount = kitItems.length;
  const kitItemsStr = kitItems
    .map(item => `${item.tipo || 'Equipamento'} - ${item.numero_serie || '—'}`)
    .join('\n');
  
  // Prepare structured equipment sections
  const equipmentSections = generateEquipmentSections(kitItems);

  const isAluno = pessoa?.tipo === 'Aluno';
  const templateType = isAluno ? 'DEVOLUCAO_ALUNO' : 'DEVOLUCAO_DOCENTE';
  const template = templates.find(t => t.tipo === templateType && t.ativo !== false) || templates.find(t => t.tipo === 'DEVOLUCAO');

  const vars = {
    equipamento: eq?.designacao || devolucao.equipamento_info || '—',
    pessoa: pessoa?.nome || devolucao.pessoa_info || '—',
    numero_aluno: isAluno ? (pessoa?.nif || '—') : '—',
    numero_docente: !isAluno ? (pessoa?.nif || '—') : '—',
    data_devolucao: formatDate(devolucao.data_devolucao),
    estado_equipamento: devolucao.estado_equipamento || '—',
    notas: devolucao.notas || '—',
    acessorios_devolvidos: formatAcessorios(devolucao.acessorios_devolvidos),
    data_hoje: formatDate(new Date()),
    uuid: devolucao.id,
    numero_serie: eq?.numero_serie || '—',
    numero_imobilizado: eq?.numero_imobilizado || '—',
    kit_count: kitCount,
    kit_items: kitItemsStr,
    
    // New variables
    data_hora: formatDataHora(),
    ee_nome: pessoa?.ee_nome || '—',
    ee_nif: pessoa?.ee_nif || '—',
    nome_aluno: isAluno ? pessoa?.nome : '—',
    nif_aluno: isAluno ? pessoa?.nif : '—',
    numero_processo_aluno: isAluno ? pessoa?.n_processo : '—',
    turma_aluno: isAluno ? pessoa?.turma : '—',
    nome_docente: !isAluno ? pessoa?.nome : '—',
    nif_docente: !isAluno ? pessoa?.nif : '—',
    utilizador_atual: currentUser?.full_name || '—',
    
    // Equipment section variables
    equipamento_secoes: equipmentSections.map(s => s.content).join(''),
    equipamento_secao_a: equipmentSections.find(s => s.letter === 'A')?.content || '',
    equipamento_secao_b: equipmentSections.find(s => s.letter === 'B')?.content || ''
  };

  await exportDocument(`Devolucao_${isAluno ? 'Aluno' : 'Docente'}`, template, vars);
}

export async function gerarPDFAvaria(avaria, templates = [], currentUser = null) {
  const eq = await db.entities.Equipamento.get(avaria.equipamento_id);
  const pessoa = avaria.pessoa_id ? await db.entities.Pessoa.get(avaria.pessoa_id) : null;
  
  // Fetch all kit items
  let kitItems = [eq];
  if (eq?.numero_imobilizado?.trim()) {
    const { data: siblings } = await db.client
      .from('equipamentos')
      .select('*')
      .eq('numero_imobilizado', eq.numero_imobilizado.trim())
      .neq('id', eq.id);
    if (siblings && siblings.length > 0) {
      kitItems = [eq, ...siblings];
    }
  }
  
  // Prepare kit variables
  const kitCount = kitItems.length;
  const kitItemsStr = kitItems
    .map(item => `${item.tipo || 'Equipamento'} - ${item.numero_serie || '—'}`)
    .join('\n');
  
  // Prepare structured equipment sections
  const equipmentSections = generateEquipmentSections(kitItems);
  
  const template = templates.find(t => t.tipo === 'AVARIA' && t.ativo !== false);

  const comps = avaria.componentes || {};
  const compStr = Object.entries({ ecra: 'Ecrã', disco: 'Disco', ram: 'RAM', board: 'Board', bateria: 'Bateria', teclado: 'Teclado', touchpad: 'Touchpad' })
    .map(([k, l]) => `${l}: ${comps[k] || 'DESCONHECIDO'}`)
    .join(', ');
  
  const vars = {
    equipamento: eq?.designacao || avaria.equipamento_info || '—',
    pessoa: pessoa?.nome || '—',
    numero_pessoa: pessoa?.nif || '—',
    estado: avaria.estado || '—',
    origem: avaria.origem || '—',
    diagnostico: avaria.diagnostico || '—',
    resolucao: avaria.resolucao || '—',
    componentes: compStr,
    data_registo: formatDate(avaria.created_date),
    data_resolucao: formatDate(avaria.data_resolucao),
    data_hoje: formatDate(new Date()),
    uuid: avaria.id,
    numero_serie: eq?.numero_serie || '—',
    numero_imobilizado: eq?.numero_imobilizado || '—',
    kit_count: kitCount,
    kit_items: kitItemsStr,
    
    // New variables
    data_hora: formatDataHora(),
    
    utilizador_atual: currentUser?.full_name || '—',
    
    // Equipment section variables
    equipamento_secoes: equipmentSections.map(s => s.content).join(''),
    equipamento_secao_a: equipmentSections.find(s => s.letter === 'A')?.content || '',
    equipamento_secao_b: equipmentSections.find(s => s.letter === 'B')?.content || ''
  };
  await exportDocument('Avaria', template, vars);
}

export async function gerarPDFEquipamento(equipamento, templates = [], currentUser = null) {
  // Fetch all kit items
  let kitItems = [equipamento];
  if (equipamento?.numero_imobilizado?.trim()) {
    const { data: siblings } = await db.client
      .from('equipamentos')
      .select('*')
      .eq('numero_imobilizado', equipamento.numero_imobilizado.trim())
      .neq('id', equipamento.id);
    if (siblings && siblings.length > 0) {
      kitItems = [equipamento, ...siblings];
    }
  }
  
  // Prepare kit variables
  const kitCount = kitItems.length;
  const kitItemsStr = kitItems
    .map(item => `${item.tipo || 'Equipamento'} - ${item.numero_serie || '—'}`)
    .join('\n');
  
  // Prepare structured equipment sections
  const equipmentSections = generateEquipmentSections(kitItems);
  
  const template = templates.find(t => t.tipo === 'EQUIPAMENTO' && t.ativo !== false);
  const vars = {
    designacao: equipamento.designacao || '—',
    numero_serie: `BOLD:${equipamento.numero_serie || '—'}`,
    numero_imobilizado: equipamento.numero_imobilizado || '—',
    tipo: equipamento.tipo || '—',
    marca: equipamento.marca || '—',
    modelo: equipamento.modelo || '—',
    estado: equipamento.estado || '—',
    data_entrada: formatDate(equipamento.data_entrada),
    notas: equipamento.notas || '—',
    data_hoje: formatDate(new Date()),
    uuid: equipamento.id,
    kit_count: kitCount,
    kit_items: kitItemsStr,
    
    // New variables
    data_hora: formatDataHora(),
    
    utilizador_atual: currentUser?.full_name || '—',
    
    // Equipment section variables
    equipamento_secoes: equipmentSections.map(s => s.content).join(''),
    equipamento_secao_a: equipmentSections.find(s => s.letter === 'A')?.content || '',
    equipamento_secao_b: equipmentSections.find(s => s.letter === 'B')?.content || ''
  };
  await exportDocument('Equipamento', template, vars);
}

export async function gerarRelatorioImportacaoPDF(summary) {
  const doc = new jsPDF();
  const dateStr = format(new Date(), 'dd/MM/yyyy HH:mm');
  
  doc.setFontSize(18);
  doc.text('Relatório de Importação de Autos', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${dateStr}`, 14, 30);
  
  const total = summary.sucesso.length + summary.sugestoes.length + Object.values(summary.erro).flat().length;
  
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text('Resumo Estatístico:', 14, 40);
  
  const stats = [
    ['Total Processado', total.toString()],
    ['Sucesso', summary.sucesso.length.toString()],
    ['Sugestões (Pendentes)', summary.sugestoes.length.toString()],
    ['Já Importado', summary.erro['Já importado (Mesma Pessoa)']?.length.toString() || '0'],
    ['Erros/Falhas', (Object.values(summary.erro).flat().length - (summary.erro['Já importado (Mesma Pessoa)']?.length || 0)).toString()]
  ];
  
  autoTable(doc, {
    startY: 45,
    head: [['Categoria', 'Quantidade']],
    body: stats,
    theme: 'striped',
    headStyles: { fillColor: [63, 81, 181] }
  });

  let currentY = doc.lastAutoTable.finalY + 15;

  // Secção de Sucesso
  if (summary.sucesso.length > 0) {
    doc.setFontSize(14);
    doc.text('Sucessos', 14, currentY);
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Ficheiro', 'Detalhe']],
      body: summary.sucesso.map(s => [s.file, s.detail]),
      headStyles: { fillColor: [76, 175, 80] }
    });
    currentY = doc.lastAutoTable.finalY + 15;
  }

  // Secção de Sugestões
  if (summary.sugestoes.length > 0) {
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.setFontSize(14);
    doc.text('Sugestões de Correção', 14, currentY);
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Ficheiro', 'S/N Ficheiro', 'S/N Sugerido', 'Pessoa']],
      body: summary.sugestoes.map(s => [s.file, s.snOriginal, s.snSugerido, s.pessoa.nome]),
      headStyles: { fillColor: [255, 152, 0] }
    });
    currentY = doc.lastAutoTable.finalY + 15;
  }

  // Secção de Erros
  const errosComuns = Object.entries(summary.erro).filter(([k, v]) => v.length > 0 && k !== 'Já importado (Mesma Pessoa)');
  if (errosComuns.length > 0) {
    for (const [reason, items] of errosComuns) {
      if (currentY > 250) { doc.addPage(); currentY = 20; }
      doc.setFontSize(14);
      doc.text(`Erro: ${reason}`, 14, currentY);
      autoTable(doc, {
        startY: currentY + 5,
        head: [['Ficheiro', 'Detalhe']],
        body: items.map(i => [i.file, i.detail]),
        headStyles: { fillColor: [244, 67, 54] }
      });
      currentY = doc.lastAutoTable.finalY + 15;
    }
  }

  // Secção de Já Importados
  if (summary.erro['Já importado (Mesma Pessoa)']?.length > 0) {
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.setFontSize(14);
    doc.text('Já Importados (Sem Alteração)', 14, currentY);
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Ficheiro', 'Detalhe']],
      body: summary.erro['Já importado (Mesma Pessoa)'].map(i => [i.file, i.detail]),
      headStyles: { fillColor: [158, 158, 158] }
    });
  }

  doc.save(`Relatorio_Importacao_Autos_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
}

export async function gerarRelatorioImportacaoAvariasPDF(summary) {
  if (!summary) return;
  const doc = new jsPDF();
  const dateStr = format(new Date(), 'dd/MM/yyyy HH:mm');
  
  doc.setFontSize(18);
  doc.text('Relatório de Importação de Avarias', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${dateStr}`, 14, 30);
  
  const total = summary.total || 0;
  
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text('Resumo Estatístico:', 14, 40);
  
  const stats = [
    ['Total no Ficheiro', total.toString()],
    ['Criadas com Sucesso', (summary.created || 0).toString()],
    ['Ignoradas (Avaria Aberta)', (summary.duplicates || 0).toString()],
    ['Ignoradas (Já Resolvida)', (summary.skipped || 0).toString()],
    ['Com Erros de Validação', (summary.errors?.length || 0).toString()]
  ];
  
  autoTable(doc, {
    startY: 45,
    head: [['Categoria', 'Quantidade']],
    body: stats,
    theme: 'striped',
    headStyles: { fillColor: [63, 81, 181] }
  });

  let currentY = doc.lastAutoTable.finalY + 15;

  // Secção de Erros (Problemas)
  if (summary.errors?.length > 0) {
    doc.setFontSize(14);
    doc.text('Problemas e Erros', 14, currentY);
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Linha', 'Equipamento/SN', 'Motivo']],
      body: summary.errors.map(e => [e.linha, e.identificador, e.motivo]),
      headStyles: { fillColor: [244, 67, 54] }
    });
    currentY = doc.lastAutoTable.finalY + 15;
  }

  // Secção de Sucesso (OK) - Apenas se houver espaço ou nova página
  if (summary.successItems?.length > 0) {
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.setFontSize(14);
    doc.text('Registos Importados com Sucesso', 14, currentY);
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Linha', 'Equipamento/SN', 'Nº Avaria']],
      body: summary.successItems.map(s => [s.linha, s.identificador, s.numero]),
      headStyles: { fillColor: [76, 175, 80] }
    });
  }

  doc.save(`Relatorio_Importacao_Avarias_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
}
