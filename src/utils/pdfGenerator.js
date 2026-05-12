import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { DocxProcessor } from './docxProcessor';
import { saveAs } from 'file-saver';
import { db } from '@/api/db';
import { toast } from 'react-hot-toast';

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

function formatAcessorios(obj) {
  if (!obj || typeof obj !== 'object') return 'Nenhum';
  return Object.entries(ACESSORIOS_LABELS)
    .filter(([k]) => obj && obj[k])
    .map(([, v]) => v)
    .join(', ') || 'Nenhum';
}

function formatDataHora(dateInput = null) {
  const date = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(date.getTime())) return '—';

  const dia = date.getDate().toString().padStart(2, '0');
  const mes = (date.getMonth() + 1).toString().padStart(2, '0');
  const ano = date.getFullYear();
  const horas = date.getHours().toString().padStart(2, '0');
  const minutos = date.getMinutes().toString().padStart(2, '0');
  return `${dia}/${mes}/${ano}, às ${horas} horas e ${minutos} minutos`;
}

function generateEquipmentSections(kitItems = []) {
  const sections = [];
  let sectionLetter = 'A';
  
  const items = kitItems || [];
  const pcs = items.filter(item => item && item.tipo?.toUpperCase().startsWith('PC'));
  const hotspots = items.filter(item => item && item.tipo?.toUpperCase().includes('HOTSPOT'));
  
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
 * @param {string} title Filename title
 * @param {object} template Template object from DB
 * @param {object} vars Variables to replace
 * @param {string} format 'pdf' or 'docx' (defaults to docx now)
 */
export async function exportDocument(title, template, vars = {}, format = 'docx') {
  if (!vars) vars = {};
  
  // Force format to docx for now as PDF engine is not reliable
  const targetFormat = format === 'pdf' ? 'docx' : format;

  return toast.promise(
    (async () => {
      // Map barcodes if they are base64 images
      const docxData = { ...vars };
      
      if (vars.numero_serie && !vars.barcode_serie) {
        try {
          vars.barcode_serie = await DocxProcessor.generateBarcode(vars.numero_serie);
        } catch (e) { console.error('Barcode error:', e); }
      }
      if (vars.numero_imobilizado && !vars.barcode_imobilizado) {
        try {
          vars.barcode_imobilizado = await DocxProcessor.generateBarcode(vars.numero_imobilizado);
        } catch (e) { console.error('Barcode error:', e); }
      }

      // Ensure barcode variables are available for DOCX without the % prefix in the data object
      if (vars.barcode_serie) docxData.barcode_serie = vars.barcode_serie;
      if (vars.barcode_imobilizado) docxData.barcode_imobilizado = vars.barcode_imobilizado;

      if (template?.file_base64) {
        try {
          // 1. Generate filled DOCX
          const docxBlob = await DocxProcessor.generateDocx(template.file_base64, docxData);
          
          // 2. Offer DOCX download
          saveAs(docxBlob, `${title.replace(/\s+/g, '_')}.docx`);
          return;
        } catch (err) {
          console.error('DOCX Export failed:', err);
          throw new Error('Falha ao gerar DOCX: ' + (err.message || 'Erro desconhecido'));
        }
      } else {
        throw new Error('Template sem ficheiro DOCX base disponível.');
      }
    })(),
    {
      loading: `A gerar documento (Word)...`,
      success: 'Documento gerado com sucesso!',
      error: (err) => err.message || 'Erro ao gerar documento'
    }
  );
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
      // Suportar ambos os delimitadores no HTML
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), displayValue ?? '—');
      content = content.replace(new RegExp(`\\[\\[${key}\\]\\]`, 'g'), displayValue ?? '—');
    }
  });
  return content;
}

export async function gerarPDFEmprestimoDiretoAluno(emprestimo, currentUser = null) {
  // Fetch full data
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
  
  const doc = new jsPDF();
  let y = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 15;
  const marginRight = 15;
  const contentWidth = pageWidth - marginLeft - marginRight;
  
  // Helper function to add text with wrap
  function addText(text, size = 12, isBold = false, indent = 0, isUnderlined = false) {
    if (y > pageHeight - 100) {
      doc.addPage();
      y = 20;
    }
    
    doc.setFontSize(size);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    if (isUnderlined) {
      doc.setDrawColor(0);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    }
    
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    doc.text(lines, marginLeft + indent, y);
    
    if (isUnderlined) {
      lines.forEach((line, i) => {
        const lineWidth = doc.getTextWidth(line);
        doc.line(marginLeft + indent, y + (i * (size / 2.5)) + 2, marginLeft + indent + lineWidth, y + (i * (size / 2.5)) + 2);
      });
    }
    
    y += (lines.length * (size / 2.5)) + 3;
  }
  
  // Add República Portuguesa logo at top left
  doc.addImage('/assets/logo-republica-portuguesa.png', 'PNG', marginLeft, y, 40, 20);
  y += 30;
  
  // Add Auto de Entrega header image
  doc.addImage('/assets/auto-de-entrega-header.png', 'PNG', marginLeft, y, contentWidth, 100);
  y += 110;
  
  // Title
  addText(`Auto de entrega nº ${emprestimo.id}`, 16, true);
  y += 5;
  
  // Header
  const dataHora = formatDataHora();
  const headerText = `No dia ${dataHora.split(' às ')[0]}, às ${dataHora.split(' às ')[1]}, na Escola Secundária D. João II, Setúbal, sita na R. Dr. Luís Macedo e Castro 2914-510 SETÚBAL procedeu-se à entrega temporária e gratuita dos bens e equipamentos informáticos, abaixo descritos a:`;
  addText(headerText);
  y += 5;
  
  // Person info
  const pessoaText = `${pessoa?.ee_nome || '—'}, Encarregado de Educação, com o NIF ${pessoa?.ee_nif || '—'}, do aluno ${pessoa?.nome || '—'}, nº de processo ${pessoa?.n_processo || '—'} matriculado na Escola Secundária D. João II, Setúbal, a frequentar o ${pessoa?.turma || '—'}, com o NIF ${pessoa?.nif || '—'}.`;
  addText(pessoaText);
  y += 10;
  
  // Equipment intro
  addText('São cedidos a título gratuito, com a obrigação de restituição, os seguintes equipamentos:');
  y += 5;
  
  // Equipment sections
  const equipmentSections = generateEquipmentSections(kitItems);
  equipmentSections.forEach(section => {
    // Split content by lines and add each line
    const lines = section.content.split('\n').filter(l => l.trim());
    lines.forEach(line => {
      // Calculate indentation based on leading tabs
      let indent = 0;
      let cleanLine = line;
      while (cleanLine.startsWith('\t')) {
        indent += 10;
        cleanLine = cleanLine.substring(1);
      }
      addText(cleanLine, 11, false, indent);
    });
    y += 5;
  });
  
  // General conditions
  addText('CONDIÇÕES GERAIS', 14, true);
  y += 5;
  
  const condicoes = [
    '1.\tOs equipamentos cedidos destinam-se a ser utilizados, exclusivamente, para fins do processo de ensino e aprendizagem do Aluno, com início em 04/5/2026 e término na data de conclusão do ciclo de estudos que o Aluno frequenta no momento da cedência, nomeadamente, nas seguintes situações:',
    '\ta.\tQuando os alunos tenham completado o ciclo ou nível de ensino a que se destinam os equipamentos a fornecer ou a escolaridade obrigatória (no final do 4º, 9º ou 12º ano);',
    '\tb.\tNas situações de transferências de alunos para outro AE/EnA distinto do 2.º outorgante;',
    '\tc.\tEm caso de aplicação de medidas disciplinares sancionatórias ao aluno que determinem a «transferência de escola» ou a «expulsão da escola», previstas, respetivamente, nas alíneas d) e e) do n.º 2 do artigo 28.º do Estatuto do Aluno e Ética Escolar, aprovado pela Lei n.º 51/2012, de 5 de setembro, na sua redação atual;',
    '\td.\tCom a saída do aluno do Ensino Público.',
    '2.\tNos casos previstos no número 1., a devolução dos equipamentos informáticos, conetividade e serviços conexos pelo EE ou pelo aluno deve ocorrer através da entrega dos mesmos nas instalações da sede do AE/EnA no prazo máximo de uma semana, após a verificação dos factos aí descritos;',
    '3.\tCaso a entrega dos equipamentos não tenha lugar no prazo previsto no n.º anterior, o/a Encarregado/a de Educação/Aluno/a (comodatário/a) será notificado/a pelo na Escola Secundária D. João II, Setúbal, para a entrega dos equipamentos no término do período previsto no n.º 1, para os contactos indicados pelo/a EE, para esta finalidade, ou na falta, para a sua morada;',
    '4.\tO equipamento informático deve ser entregue limpo de ficheiros pessoais dos seus utilizadores e subcessionários;',
    '5.\tO Encarregado de Educação subcessionário obriga-se a zelar pela conservação dos bens e equipamentos que lhe são cedidos por comodato (empréstimo), devendo restituí-los no fim do período indicado nos pontos anteriores nas condições que resultam de um uso responsável e prudente, sob pena do acionamento de obrigações contratualmente previstas por perda ou deterioração dos bens e equipamentos;',
    '6.\tA instalação de programas ou aplicações informáticas (software) no equipamento cedido, deve ser feita exclusivamente para fins do processo de ensino e aprendizagem;',
    '7.\tA instalação ou remoção de partes ou componentes (hardware) do equipamento é expressamente proibida;',
    '8.\tO Encarregado de Educação/Aluno está autorizado a deslocar os equipamentos para fora da morada da sua residência ou domicílio indicada neste auto de entrega, exclusivamente para fins relacionados com o processo de ensino e aprendizagem e bem assim nas situações em que sejam previamente autorizados pelo Ministério da Educação ou pelo/a Diretor(a) do AE/EnA;',
    '9.\tO Encarregado de Educação subcessionário obriga-se a comunicar imediatamente ao Escola Secundária D. João II, Setúbal a perda ou o roubo dos bens ou equipamentos;',
    '10.\tO Encarregado de Educação subcessionário obriga-se, ainda, a suportar todas as despesas devidas pela recuperação dos bens ou equipamentos sempre que os danos advenham de mau uso ou negligência na sua conservação;',
    '11.\tÉ vedada ao Encarregado de Educação subcessionário a possibilidade de sub-comodatar ou locar os bens ou equipamentos objeto cedido a terceiros;',
    '12.\tEm tudo o que não consta nos pontos anteriores, são aplicáveis à presente cedência de equipamentos para o acesso e a utilização de recursos didáticos e educativos digitais, as disposições constantes dos artigos 1129.º a 1137.º do Código Civil, relativas ao contrato de comodato.'
  ];
  condicoes.forEach(cond => {
    let indent = 0;
    let cleanLine = cond;
    while (cleanLine.startsWith('\t')) {
      indent += 10;
      cleanLine = cleanLine.substring(1);
    }
    addText(cleanLine, 11, false, indent);
  });
  y += 10;
  
  // Data protection section
  addText('TRATAMENTO DE DADOS PESSOAIS, DECLARAÇÃO DE CONSENTIMENTO E EXERCÍCIO DE DIREITOS', 14, true);
  y += 5;
  
  const dpText = [
    '13.\tO tratamento de dados pessoais é realizado no âmbito da Medida «Universalização da Escola Digital», com base na gestão da relação contratual, para efeitos de gestão da entrega dos equipamentos informáticos, de acordo com os termos e condições da Política de Proteção de Dados acessível em https://registoequipamento.escoladigital.min-educ.pt.',
    '14.\tO Encarregado de Educação, sendo titular dos dados pessoais constantes do presente auto de entrega de bens ou equipamentos informáticos autoriza expressamente a que os mesmos sejam objeto de recolha, utilização, registo e tratamento, ao abrigo da alínea a) do n.º1 do art.6.º do Regulamento Geral sobre Proteção de Dados (RGPD), para efeitos de monitorização, verificação, controlo e avaliação no quadro da implementação dos Fundos Europeus Estruturais e de Investimento (FEEI) e respetivo reporte à Comissão Europeia e restantes entidades envolvidas, no âmbito dos respetivos projetos comunitários financiadores e sempre que solicitado pelas autoridades nacionais e comunitárias legalmente competentes, no âmbito das quais também podem ser solicitados comprovativos de matrícula e da condição',
    '\tde beneficiário do escalão de Ação Social Escolar identificado no proémio pelas mesmas autoridades',
    'SIM, ACEITO que os meus dados pessoais e, se aplicável, os do meu educando, sejam objeto de recolha, utilização, registo e tratamento, para os efeitos indicados no presente documento',
    '15.\tO Encarregado de Educação/Aluno, enquanto titular dos dados pessoais, está consciente de que pode solicitar informações, apresentar reclamações, comunicar incidentes ou exercer direitos de proteção de dados, designadamente e entre outros, os direitos de acesso, retificação, oposição ou limitação do tratamento, portabilidade, apagamento ou retirada do consentimento, através de contacto com o Encarregado da Proteção de Dados do Agrupamento de Escola ou Escola não Agrupada, cujos contactos estão disponíveis na respetiva Política de Proteção de Dados.'
  ];
  dpText.forEach(text => {
    let indent = 0;
    let cleanLine = text;
    const isSimAceito = cleanLine.trim().startsWith('SIM, ACEITO');
    while (cleanLine.startsWith('\t')) {
      indent += 10;
      cleanLine = cleanLine.substring(1);
    }
    addText(cleanLine, 11, false, indent, isSimAceito);
  });
  y += 20;
  
  // Signature section
  addText('Entregue por:', 12, false);
  // Add signature line
  doc.setDrawColor(0);
  doc.line(marginLeft, y + 5, marginLeft + 180, y + 5);
  y += 20;
  
  addText('Cargo/categoria:', 12, false);
  doc.setDrawColor(0);
  doc.line(marginLeft, y + 5, marginLeft + 180, y + 5);
  y += 30;
  
  addText('Assinatura do responsável pela entrega dos equipamentos:', 12, false);
  doc.setDrawColor(0);
  doc.line(marginLeft, y + 5, marginLeft + 180, y + 5);
  
  addText('Encarregado de Educação do Aluno:', 12, false, pageWidth / 2);
  doc.setDrawColor(0);
  doc.line(marginLeft + pageWidth / 2, y + 5, marginLeft + pageWidth / 2 + 180, y + 5);
  y += 40;
  
  // Signatures
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const userText = currentUser?.full_name || '—';
  const eeText = pessoa?.ee_nome || '—';
  const userWidth = doc.getTextWidth(userText);
  const eeWidth = doc.getTextWidth(eeText);
  doc.text(userText, marginLeft + 90 - userWidth / 2, y);
  doc.text(eeText, marginLeft + pageWidth / 2 + 90 - eeWidth / 2, y);
  y += 30;
  
  // Add footer logos (apoios) on the last page
  if (y > pageHeight - 120) {
    doc.addPage();
    y = 20;
  }
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Apoios:', pageWidth / 2, y, { align: 'center' });
  y += 15;
  
  // Add apoios logos
  doc.addImage('/assets/apoios-logos.png', 'PNG', marginLeft, y, contentWidth, 70);
  
  // Add footer
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - marginRight, pageHeight - 10, { align: 'right' });
  }
  
  doc.save(`Auto_Entrega_Aluno_${emprestimo.id}.pdf`);
}

/**
 * Prepares variables for an loan document (borrow or return)
 */
export async function prepareLoanVars(emprestimo, pessoa, eq, kitItems, currentUser, type = 'emprestimo') {
  const isBorrow = type === 'emprestimo';
  
  // Prepare kit variables
  const validKitItems = (kitItems || []).filter(item => item && typeof item === 'object');
  const kitCount = validKitItems.length;
  const kitItemsStr = validKitItems
    .map(item => `${item.tipo || 'Equipamento'} - ${item.numero_serie || '—'}`)
    .join('\n');
  
  // Prepare structured equipment sections
  const equipmentSections = generateEquipmentSections(validKitItems);
  
  const isAluno = pessoa?.tipo === 'Aluno';
  
  // Generate header section
  const dataHoraStr = formatDataHora(isBorrow ? (emprestimo.data_emprestimo || emprestimo.created_at) : (emprestimo.data_devolucao || emprestimo.created_at));
  const dataParte = dataHoraStr.split(', às ')[0];
  const horaParte = dataHoraStr.split(', às ')[1];
  
  let cabecalhoEntrega = '';
  if (isAluno) {
    const infoAluno = [
      pessoa?.ee_nome ? `${pessoa.ee_nome}, Encarregado de Educação` : '',
      pessoa?.ee_nif ? `com o NIF ${pessoa.ee_nif}` : '',
      pessoa?.nome ? `do aluno ${pessoa.nome}` : '',
      pessoa?.n_processo ? `nº de processo ${pessoa.n_processo}` : '',
      'matriculado na Escola Secundária D. João II, Setúbal',
      pessoa?.turma ? `a frequentar o ${pessoa.turma}` : '',
      pessoa?.nif ? `com o NIF ${pessoa.nif}` : ''
    ].filter(Boolean).join(', ');

    cabecalhoEntrega = `Auto de Entrega nº ${emprestimo.id}\n\nNo dia ${dataParte}, às ${horaParte}, na Escola Secundária D. João II, Setúbal, sita na R. Dr. Luís Macedo e Castro 2914-510 SETÚBAL procedeu-se à entrega temporária e gratuita dos bens e equipamentos informáticos, abaixo descritos a:\n\n${infoAluno}.`;
  } else {
    const infoDocente = [
      pessoa?.nome ? `${pessoa.nome}, Docente` : '',
      pessoa?.grupo_recrutamento ? `do grupo de recrutamento ${pessoa.grupo_recrutamento}` : '',
      pessoa?.qe ? `do QE ${pessoa.qe}` : '',
      pessoa?.email ? `email ${pessoa.email}` : '',
      'a exercer funções letivas no Escola Secundária D. João II, Setúbal',
      pessoa?.morada ? `e residente em ${pessoa.morada}` : '',
      pessoa?.nif ? `com o NIF ${pessoa.nif}` : '',
      pessoa?.cc_numero ? `titular do Cartão de Cidadão n.º ${pessoa.cc_numero}` : ''
    ].filter(Boolean).join(', ');

    cabecalhoEntrega = `Auto de Entrega nº ${emprestimo.id}\n\nNo dia ${dataParte}, às ${horaParte}, na Escola Secundária D. João II, Setúbal, sita na R. Dr. Luís Macedo e Castro 2914-510 SETÚBAL procedeu-se à entrega temporária e gratuita dos bens e equipamentos informáticos, abaixo descritos a:\n\n${infoDocente}.`;
  }

  let cabecalhoDevolucao = '';
  if (!isBorrow) {
    if (isAluno) {
      const infoAluno = [
        pessoa?.ee_nome ? `${pessoa.ee_nome}, Encarregado de Educação` : '',
        pessoa?.ee_nif ? `com o NIF ${pessoa.ee_nif}` : '',
        pessoa?.ee_cc ? `titular do Cartão de cidadão n.º ${pessoa.ee_cc}` : '',
        pessoa?.nome ? `do aluno ${pessoa.nome}` : '',
        'matriculado na Escola Secundária D. João II, Setúbal',
        pessoa?.turma ? `a frequentar o ${pessoa.turma}` : '',
        pessoa?.morada ? `${pessoa.morada}` : '',
        pessoa?.nif ? `com o NIF ${pessoa.nif}` : '',
        pessoa?.cc_numero ? `titular do Cartão de cidadão n.º ${pessoa.cc_numero}` : ''
      ].filter(Boolean).join(', ');

      cabecalhoDevolucao = `No dia ${dataParte}, às ${horaParte}, na Escola Secundária D. João II, Setúbal, procedeu-se à recolha e receção dos bens e equipamentos informáticos, abaixo descritos e que estavam na posse de:\n\n${infoAluno}, conforme auto de entrega nº ${emprestimo.id}.`;
    } else {
      const infoDocente = [
        pessoa?.nome ? `${pessoa.nome}, Docente` : '',
        pessoa?.grupo_recrutamento ? `do grupo de recrutamento ${pessoa.grupo_recrutamento}` : '',
        pessoa?.qe ? `do QE ${pessoa.qe}` : '',
        pessoa?.email ? `email ${pessoa.email}` : '',
        'a exercer funções letivas no Escola Secundária D. João II, Setúbal',
        pessoa?.morada ? `e residente em ${pessoa.morada}` : '',
        pessoa?.nif ? `com o NIF ${pessoa.nif}` : '',
        pessoa?.cc_numero ? `titular do Cartão de cidadão n.º ${pessoa.cc_numero}` : ''
      ].filter(Boolean).join(', ');

      cabecalhoDevolucao = `No dia ${dataParte}, às ${horaParte}, na Escola Secundária D. João II, Setúbal, procedeu-se à recolha e receção dos bens e equipamentos informáticos, abaixo descritos e que estavam na posse de:\n\n${infoDocente}, conforme auto de entrega nº ${emprestimo.id}.`;
    }
  }

  return {
    equipamento: eq?.designacao || (isBorrow ? emprestimo.equipamento_info : emprestimo.equipamento_info) || '—',
    pessoa: pessoa?.nome || (isBorrow ? emprestimo.pessoa_info : emprestimo.pessoa_info) || '—',
    numero_aluno: isAluno ? (pessoa?.nif || '—') : '—',
    numero_docente: !isAluno ? (pessoa?.nif || '—') : '—',
    data_emprestimo: formatDate(isBorrow ? emprestimo.data_emprestimo : emprestimo.data_emprestimo),
    data_devolucao: isBorrow ? '—' : formatDate(emprestimo.data_devolucao),
    estado_equipamento: isBorrow ? '—' : (emprestimo.estado_equipamento || '—'),
    notas_entrega: isBorrow ? (emprestimo.notas_entrega || '—') : '—',
    notas: isBorrow ? (emprestimo.notas_entrega || '—') : (emprestimo.notas || '—'),
    acessorios: isBorrow ? formatAcessorios(emprestimo.acessorios_entregues) : formatAcessorios(emprestimo.acessorios_devolvidos),
    acessorios_devolvidos: isBorrow ? '—' : formatAcessorios(emprestimo.acessorios_devolvidos),
    data_hoje: formatDate(new Date()),
    uuid: emprestimo.id || '—',
    numero_serie: eq?.numero_serie || '—',
    numero_imobilizado: eq?.numero_imobilizado || '—',
    kit_count: kitCount || 0,
    kit_items: kitItemsStr || '—',
    
    // New variables
    data_hora: dataHoraStr || '—',
    ee_nome: pessoa?.ee_nome || '—',
    ee_nif: pessoa?.ee_nif || '—',
    ee_cc: pessoa?.ee_cc || '—',
    nome_aluno: isAluno ? (pessoa?.nome || '—') : '—',
    nif_aluno: isAluno ? (pessoa?.nif || '—') : '—',
    numero_processo_aluno: isAluno ? (pessoa?.n_processo || '—') : '—',
    turma_aluno: isAluno ? (pessoa?.turma || '—') : '—',
    morada_pessoa: pessoa?.morada || '—',
    cc_pessoa: pessoa?.cc_numero || '—',
    nome_docente: !isAluno ? (pessoa?.nome || '—') : '—',
    nif_docente: !isAluno ? (pessoa?.nif || '—') : '—',
    cabecalho_entrega: cabecalhoEntrega || '—',
    cabecalho_devolucao: cabecalhoDevolucao || '—',
    utilizador_atual: currentUser?.full_name || '—',
    
    // Docente-specific variables
    docente_grupo_recrutamento: pessoa?.grupo_recrutamento || '—',
    docente_qe: pessoa?.qe || '—',
    docente_cc_numero: pessoa?.cc_numero || '—',
    
    // Equipment section variables
    equipamento_secoes: (equipmentSections || []).map(s => s.content || '').join('') || '—',
    equipamento_secao_a: equipmentSections?.find(s => s.letter === 'A')?.content || '',
    equipamento_secao_b: equipmentSections?.find(s => s.letter === 'B')?.content || ''
  };
}

export async function gerarPDFEmprestimo(emprestimo, templates = [], currentUser = null, format = null) {
  if (!emprestimo) {
    toast.error('Dados do empréstimo não fornecidos.');
    return;
  }

  // Fetch full data if needed
  const pessoa = await db.entities.Pessoa.get(emprestimo.pessoa_id);
  const eq = await db.entities.Equipamento.get(emprestimo.equipamento_id);
  
  // Fetch all kit items
  let kitItems = eq ? [eq] : [];
  if (eq?.numero_imobilizado?.trim()) {
    try {
      const { data: siblings } = await db.client
        .from('equipamentos')
        .select('*')
        .eq('numero_imobilizado', eq.numero_imobilizado.trim())
        .neq('id', eq.id);
      if (siblings && siblings.length > 0) {
        kitItems = [eq, ...siblings];
      }
    } catch (e) {
      console.warn('Erro ao buscar equipamentos do conjunto:', e);
    }
  }
  
  const vars = await prepareLoanVars(emprestimo, pessoa, eq, kitItems, currentUser, 'emprestimo');

  const isAluno = pessoa?.tipo === 'Aluno';
  const templateType = isAluno ? 'EMPRESTIMO_ALUNO' : 'EMPRESTIMO_DOCENTE';
  
  // Encontrar o template adequado
  const template = templates.find(t => t.tipo === templateType && t.ativo !== false) || 
                   templates.find(t => t.tipo === 'EMPRESTIMO' && t.ativo !== false) ||
                   templates[0]; // Fallback para o primeiro se nenhum coincidir

  if (!template) {
    toast.error('Nenhum template de documento encontrado. Por favor, configure um nas Definições.');
    return;
  }

  await exportDocument(`Emprestimo_${isAluno ? 'Aluno' : 'Docente'}`, template, vars, format);
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
  const validKitItems = (kitItems || []).filter(Boolean);
  const kitCount = validKitItems.length;
  const kitItemsStr = validKitItems
    .map(item => `${item.tipo || 'Equipamento'} - ${item.numero_serie || '—'}`)
    .join('\n');
  
  // Prepare structured equipment sections
  const equipmentSections = generateEquipmentSections(validKitItems);

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
  const validKitItems = (kitItems || []).filter(Boolean);
  const kitCount = validKitItems.length;
  const kitItemsStr = validKitItems
    .map(item => `${item.tipo || 'Equipamento'} - ${item.numero_serie || '—'}`)
    .join('\n');
  
  // Prepare structured equipment sections
  const equipmentSections = generateEquipmentSections(validKitItems);
  
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
    data_hora: formatDataHora(avaria.created_date || avaria.created_at),
    
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
  const validKitItems = (kitItems || []).filter(Boolean);
  const kitCount = validKitItems.length;
  const kitItemsStr = validKitItems
    .map(item => `${item.tipo || 'Equipamento'} - ${item.numero_serie || '—'}`)
    .join('\n');
  
  // Prepare structured equipment sections
  const equipmentSections = generateEquipmentSections(validKitItems);
  
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
    data_hora: formatDataHora(),
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
