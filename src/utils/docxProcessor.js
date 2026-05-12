import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import { saveAs } from 'file-saver';
import mammoth from 'mammoth';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, TextRun, ImageRun, Header, Footer, WidthType } from 'docx';
const TRANSPARENT_PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/**
 * Utility to handle native DOCX templates
 */
export const DocxProcessor = {
  
  /**
   * Reads a file and returns its Base64 content and HTML preview
   */
  async parseDocx(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const base64 = btoa(
            new Uint8Array(arrayBuffer)
              .reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          
          // Generate HTML preview for the editor
          const preview = await mammoth.convertToHtml({ arrayBuffer });
          
          resolve({
            base64,
            html: preview.value
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Generates HTML preview from DOCX Base64
   */
  async getHtmlFromBase64(base64) {
    if (!base64) return '';
    try {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const { value } = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
      return value;
    } catch (err) {
      console.error('Error generating HTML from Base64:', err);
      return '';
    }
  },

  /**
   * Replaces variables in a DOCX Base64 and returns a Blob
   */
  async generateDocx(base64, data = {}) {
    try {
      if (!base64) throw new Error('Base64 do template não fornecido.');
      
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const zip = new PizZip(bytes);

      const opts = {
        centered: false,
        getImage(tagValue) {
          // Fallback to transparent pixel if no value
          if (!tagValue || typeof tagValue !== 'string' || tagValue === '—' || tagValue === '') {
            return new Uint8Array(atob(TRANSPARENT_PIXEL).split("").map(c => c.charCodeAt(0)));
          }
          
          try {
            const base64Data = tagValue.includes('base64,') ? tagValue.split(',')[1] : tagValue;
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes;
          } catch (e) {
            console.warn('Failed to process image tag:', e);
            return new Uint8Array(atob(TRANSPARENT_PIXEL).split("").map(c => c.charCodeAt(0)));
          }
        },
        getSize(img, tagValue, tagName) {
          // If it's the transparent pixel, make it tiny
          if (tagValue === TRANSPARENT_PIXEL || !tagValue || tagValue === '—') return [1, 1];
          return [150, 50]; // Default [width, height] in pixels
        }
      };
      const imageModule = new ImageModule(opts);

      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        modules: [imageModule],
        delimiters: {
          start: '[[',
          end: ']]'
        },
        parser: (tag) => {
          return {
            get(scope) {
              if (scope === null || scope === undefined) return '';
              
              const isImageTag = tag.startsWith('%');
              const cleanTag = isImageTag ? tag.substring(1) : tag;
              
              let value = '';
              try {
                if (scope && typeof scope === 'object') {
                  value = scope[cleanTag] ?? scope[tag] ?? '';
                } else {
                  value = scope ?? '';
                }
              } catch (e) { 
                value = '';
              }
              
              // If it's an image tag and we have no value, return the transparent pixel string
              if (isImageTag && (!value || value === '—' || value === '')) {
                return TRANSPARENT_PIXEL; 
              }
              
              if (typeof value === 'string' && value.startsWith('BOLD:')) {
                return value.replace('BOLD:', '');
              }
              
              return value ?? '';
            }
          };
        }
      });

      const safeData = data && typeof data === 'object' ? data : {};

      try {
        doc.render(safeData);
      } catch (error) {
        console.error('Docxtemplater render error:', error);
        if (error.properties && error.properties.errors instanceof Array) {
          const errorMessages = error.properties.errors
            .map(err => err.properties?.explanation || err.message)
            .join(' | ');
          throw new Error(`Erro no template: ${errorMessages}`);
        }
        throw error;
      }

      const out = doc.getZip().generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      return out;
    } catch (error) {
      console.error('Error in generateDocx:', error);
      throw error;
    }
  },

  /**
   * Generates a barcode as a Base64 PNG string
   */
  async generateBarcode(text) {
    if (!text || text === '—') return TRANSPARENT_PIXEL;
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, text, {
        format: "CODE128",
        width: 2,
        height: 40,
        displayValue: true
      });
      return canvas.toDataURL('image/png').split(',')[1];
    } catch (err) {
      console.error('Error generating barcode:', err);
      return TRANSPARENT_PIXEL;
    }
  },

  /**
   * Converts HTML to PDF using html2canvas + jsPDF (faster and multi-page)
   */
  async htmlToPdf(htmlContent, filename) {
    console.log('Starting optimized PDF generation for:', filename);
    
    const container = document.createElement('div');
    container.style.width = '750px'; // Optimization: smaller width for faster capture
    container.style.padding = '40px';
    container.style.position = 'fixed';
    container.style.left = '0';
    container.style.top = '0';
    container.style.zIndex = '-9999';
    container.style.backgroundColor = 'white';
    container.style.color = 'black';
    container.style.opacity = '0.001';
    container.style.pointerEvents = 'none';
    container.style.fontFamily = 'Arial, sans-serif';
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    try {
      // Wait for images to load
      const images = container.getElementsByTagName('img');
      await Promise.all(Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
          setTimeout(resolve, 2000); // Safety timeout
        });
      }));

      // Use html2canvas directly for better control
      const canvas = await html2canvas(container, {
        scale: 1.5, // Balance between quality and speed
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 750,
        height: container.scrollHeight,
        removeContainer: true
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.85); // JPEG is much faster and smaller
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add subsequent pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(filename || 'documento.pdf');
      console.log('PDF saved successfully');
    } catch (err) {
      console.error('Error in htmlToPdf:', err);
      throw err;
    } finally {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    }
  },
  
  /**
   * Rebuilds a clean DOCX from HTML (removes broken tags)
   */
  async rebuildCleanDocx(htmlContent) {
    // Parse HTML to extract plain text with tags intact
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    // Create paragraphs from the HTML content
    const children = Array.from(tempDiv.childNodes);
    const paragraphs = [];
    
    for (const node of children) {
      if (node.nodeName === 'P' || node.nodeName === 'DIV') {
        const textRuns = [];
        const nodeChildren = Array.from(node.childNodes);
        
        for (const child of nodeChildren) {
          if (child.nodeType === Node.TEXT_NODE) {
            textRuns.push(new TextRun(child.textContent));
          } else if (child.nodeName === 'BR') {
            textRuns.push(new TextRun({ break: 1 }));
          } else if (child.nodeName === 'STRONG' || child.nodeName === 'B') {
            textRuns.push(new TextRun({ text: child.textContent, bold: true }));
          } else if (child.nodeName === 'EM' || child.nodeName === 'I') {
            textRuns.push(new TextRun({ text: child.textContent, italics: true }));
          } else {
            textRuns.push(new TextRun(child.textContent));
          }
        }
        
        paragraphs.push(new Paragraph({ children: textRuns.length > 0 ? textRuns : [new TextRun('')] }));
      } else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        paragraphs.push(new Paragraph({ children: [new TextRun(node.textContent)] }));
      } else if (node.nodeName === 'BR') {
        paragraphs.push(new Paragraph({ children: [new TextRun('')] }));
      }
    }
    
    // Create the DOCX document
    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs.length > 0 ? paragraphs : [new Paragraph('')]
      }]
    });
    
    // Generate the blob and convert to Base64
    const blob = await Packer.toBlob(doc);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve({ base64, blob });
      };
      reader.readAsDataURL(blob);
    });
  },
  
  async generateDefaultStudentLoanTemplate() {
    // Default template text with all placeholders using new delimiters [[ ]]
    const paragraphs = [
      new Paragraph({
        children: [
          new TextRun({ text: "Auto de entrega nº ", bold: true, size: 28 }),
          new TextRun({ text: "[[uuid]]", size: 28 })
        ],
        spacing: { after: 200 },
        alignment: "center"
      }),
      new Paragraph({ 
        children: [new TextRun("[[cabecalho_entrega]]")], 
        spacing: { after: 200 },
        alignment: "both"
      }),
      new Paragraph({ 
        children: [new TextRun("São cedidos a título gratuito, com a obrigação de restituição, os seguintes equipamentos:")], 
        spacing: { after: 200 },
        alignment: "both"
      }),
      new Paragraph({ 
        children: [new TextRun("[[equipamento_secoes]]")], 
        spacing: { after: 400 },
        alignment: "both"
      }),
      new Paragraph({ children: [new TextRun({ text: "CONDIÇÕES GERAIS", bold: true, size: 24 })], spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun("1.\tOs equipamentos cedidos destinam-se a ser utilizados, exclusivamente, para fins do processo de ensino e aprendizagem do Aluno, com início em 04/5/2026 e término na data de conclusão do ciclo de estudos que o Aluno frequenta no momento da cedência, nomeadamente, nas seguintes situações:")], spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun("\ta.\tQuando os alunos tenham completado o ciclo ou nível de ensino a que se destinam os equipamentos a fornecer ou a escolaridade obrigatória (no final do 4º, 9º ou 12º ano);")], spacing: { after: 100 } }),
      new Paragraph({ children: [new TextRun("\tb.\tNas situações de transferências de alunos para outro AE/EnA distinto do 2.º outorgante;")], spacing: { after: 100 } }),
      new Paragraph({ children: [new TextRun("\tc.\tEm caso de aplicação de medidas disciplinares sancionatórias ao aluno que determinem a «transferência de escola» ou a «expulsão da escola», previstas, respetivamente, nas alíneas d) e e) do n.º 2 do artigo 28.º do Estatuto do Aluno e Ética Escolar, aprovado pela Lei n.º 51/2012, de 5 de setembro, na sua redação atual;")], spacing: { after: 100 } }),
      new Paragraph({ children: [new TextRun("\td.\tCom a saída do aluno do Ensino Público.")], spacing: { after: 400 } }),
      new Paragraph({ children: [new TextRun("2.\tNos casos previstos no número 1., a devolução dos equipamentos informáticos, conetividade e serviços conexos pelo EE ou pelo aluno deve ocorrer através da entrega dos mesmos nas instalações da sede do AE/EnA no prazo máximo de uma semana, após a verificação dos factos aí descritos;")], spacing: { after: 200 }, alignment: "both" }),
      new Paragraph({ children: [new TextRun("3.\tCaso a entrega dos equipamentos não tenha lugar no prazo previsto no n.º anterior, o/a Encarregado/a de Educação/Aluno/a (comodatário/a) será notificado/a pelo na Escola Secundária D. João II, Setúbal, para a entrega dos equipamentos no término do período previsto no n.º 1, para os contactos indicados pelo/a EE, para esta finalidade, ou na falta, para a sua morada;")], spacing: { after: 200 }, alignment: "both" }),
      new Paragraph({ children: [new TextRun("4.\tO equipamento informático deve ser entregue limpo de ficheiros pessoais dos seus utilizadores e subcessionários;")], spacing: { after: 200 }, alignment: "both" }),
      new Paragraph({ children: [new TextRun("5.\tO Encarregado de Educação subcessionário obriga-se a zelar pela conservação dos bens e equipamentos que lhe são cedidos por comodato (empréstimo), devendo restituí-los no fim do período indicado nos pontos anteriores nas condições que resultam de um uso responsável e prudente, sob pena do acionamento de obrigações contratualmente previstas por perda ou deterioração dos bens e equipamentos;")], spacing: { after: 200 }, alignment: "both" }),
      new Paragraph({ children: [new TextRun("6.\tA instalação de programas ou aplicações informáticas (software) no equipamento cedido, deve ser feita exclusivamente para fins do processo de ensino e aprendizagem;")], spacing: { after: 200 }, alignment: "both" }),
      new Paragraph({ children: [new TextRun("7.\tA instalação ou remoção de partes ou componentes (hardware) do equipamento é expressamente proibida;")], spacing: { after: 200 }, alignment: "both" }),
      new Paragraph({ children: [new TextRun("8.\tO Encarregado de Educação/Aluno está autorizado a deslocar os equipamentos para fora da morada da sua residência ou domicílio indicada neste auto de entrega, exclusivamente para fins relacionados com o processo de ensino e aprendizagem e bem assim nas situações em que sejam previamente autorizados pelo Ministério da Educação ou pelo/a Diretor(a) do AE/EnA;")], spacing: { after: 200 }, alignment: "both" }),
      new Paragraph({ children: [new TextRun("9.\tO Encarregado de Educação subcessionário obriga-se a comunicar imediatamente ao Escola Secundária D. João II, Setúbal a perda ou o roubo dos bens ou equipamentos;")], spacing: { after: 200 }, alignment: "both" }),
      new Paragraph({ children: [new TextRun("10.\tO Encarregado de Educação subcessionário obriga-se, ainda, a suportar todas as despesas devidas pela recuperação dos bens ou equipamentos sempre que os danos advenham de mau uso ou negligência na sua conservação;")], spacing: { after: 200 }, alignment: "both" }),
      new Paragraph({ children: [new TextRun("11.\tÉ vedada ao Encarregado de Educação subcessionário a possibilidade de sub-comodatar ou locar os bens ou equipamentos objeto cedido a terceiros;")], spacing: { after: 200 }, alignment: "both" }),
      new Paragraph({ children: [new TextRun("12.\tEm tudo o que não consta nos pontos anteriores, são aplicáveis à presente cedência de equipamentos para o acesso e a utilização de recursos didáticos e educativos digitais, as disposições constantes dos artigos 1129.º a 1137.º do Código Civil, relativas ao contrato de comodato.")], spacing: { after: 400 }, alignment: "both" }),
      new Paragraph({ children: [new TextRun({ text: "TRATAMENTO DE DADOS PESSOAIS, DECLARAÇÃO DE CONSENTIMENTO E EXERCÍCIO DE DIREITOS", bold: true, size: 24 })], spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun("13.\tO tratamento de dados pessoais é realizado no âmbito da Medida «Universalização da Escola Digital», com base na gestão da relação contratual, para efeitos de gestão da entrega dos equipamentos informáticos, de acordo com os termos e condições da Política de Proteção de Dados acessível em https://registoequipamento.escoladigital.min-educ.pt.")], spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun("14.\tO Encarregado de Educação, sendo titular dos dados pessoais constantes do presente auto de entrega de bens ou equipamentos informáticos autoriza expressamente a que os mesmos sejam objeto de recolha, utilização, registo e tratamento, ao abrigo da alínea a) do n.º1 do art.6.º do Regulamento Geral sobre Proteção de Dados (RGPD), para efeitos de monitorização, verificação, controlo e avaliação no quadro da implementação dos Fundos Europeus Estruturais e de Investimento (FEEI) e respetivo reporte à Comissão Europeia e restantes entidades envolvidas, no âmbito dos respetivos projetos comunitários financiadores e sempre que solicitado pelas autoridades nacionais e comunitárias legalmente competentes, no âmbito das quais também podem ser solicitados comprovativos de matrícula e da condição")], spacing: { after: 100 } }),
      new Paragraph({ children: [new TextRun("\tde beneficiário do escalão de Ação Social Escolar identificado no proémio pelas mesmas autoridades")], spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun("SIM, ACEITO que os meus dados pessoais e, se aplicável, os do meu educando, sejam objeto de recolha, utilização, registo e tratamento, para los efeitos indicados no presente documento")], spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun("15.\tO Encarregado de Educação/Aluno, enquanto titular dos dados pessoais, está consciente de que pode solicitar informações, apresentar reclamações, comunicar incidentes ou exercer direitos de proteção de dados, designadamente e entre outros, os direitos de acesso, retificação, oposição ou limitação do tratamento, portabilidade, apagamento ou retirada do consentimento, através de contacto com o Encarregado da Proteção de Dados do Agrupamento de Escola ou Escola não Agrupada, cujos contactos estão disponíveis na respetiva Política de Proteção de Dados.")], spacing: { after: 600 } }),
      new Paragraph({ children: [new TextRun("Entregue por:")], spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun("")], spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun("Cargo/categoria:")], spacing: { after: 400 } }),
      new Paragraph({ children: [new TextRun("")], spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun("Assinatura do responsável pela entrega dos equipamentos:")], spacing: { after: 400 } }),
      new Paragraph({ children: [new TextRun("Encarregado de Educação do Aluno:")], spacing: { after: 600 } }),
      new Paragraph({ children: [new TextRun("")], spacing: { after: 400 } }),
      new Paragraph({
        children: [
          new TextRun({ text: "[[utilizador_atual]]", bold: true }),
          new TextRun("\t\t"),
          new TextRun({ text: "[[ee_nome]]", bold: true })
        ],
        alignment: "center"
      })
    ];
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs
      }]
    });
    
    const blob = await Packer.toBlob(doc);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve({ base64, blob });
      };
      reader.readAsDataURL(blob);
    });
  }
};
