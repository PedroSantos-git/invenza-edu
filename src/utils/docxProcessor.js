import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import { saveAs } from 'file-saver';
import mammoth from 'mammoth';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
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
   * Replaces variables in a DOCX Base64 and returns a Blob
   */
  async generateDocx(base64, data) {
    try {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const zip = new PizZip(bytes);

      const opts = {
        centered: false,
        getImage(tagValue) {
          if (!tagValue) return null;
          // Assume tagValue is a base64 string or URL
          const base64Data = tagValue.split(',')[1] || tagValue;
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return bytes;
        },
        getSize() {
          return [150, 50]; // [width, height] in pixels
        }
      };
      const imageModule = new ImageModule(opts);

      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        modules: [imageModule],
        parser: (tag) => {
          return {
            get(scope) {
              let value = scope[tag];
              if (typeof value === 'string' && value.startsWith('BOLD:')) {
                return value.replace('BOLD:', '');
              }
              return value;
            }
          };
        }
      });

      doc.render(data);

      const out = doc.getZip().generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      return out;
    } catch (error) {
      console.error('Error generating DOCX:', error);
      throw error;
    }
  },

  /**
   * Generates a barcode as a base64 image using a public API
   */
  async generateBarcode(text) {
    if (!text) return null;
    try {
      // Using bwip-js online API for simplicity and quality
      const url = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(text)}&scale=2&rotate=N&includetext=true`;
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.error('Error generating barcode:', err);
      return null;
    }
  },

  /**
   * Converts HTML to PDF using a hidden container (professional quality)
   */
  async htmlToPdf(htmlContent, filename) {
    const container = document.createElement('div');
    container.style.width = '210mm';
    container.style.padding = '20mm';
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.backgroundColor = 'white';
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(filename || 'documento.pdf');
    } finally {
      document.body.removeChild(container);
    }
  }
};
