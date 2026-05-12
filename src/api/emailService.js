import { db } from '@/api/db';

export const EmailService = {
  async send({ to, cc, subject, body, pessoa_id, tipo }) {
    try {
      // 1. Obter configuração SMTP
      const configs = await db.entities.Configuracao.list();
      const emailConfig = configs.find(c => c.id === 'email');
      const config = emailConfig?.dados;

      if (!config || !config.host || !config.user || !config.pass) {
        const errorMsg = 'Configuração SMTP incompleta. Vá a Configurações > Email e preencha o Servidor, Porta, Utilizador e Password.';
        console.error(errorMsg, config);
        throw new Error(errorMsg);
      }

      // 2. Obter horário para incluir no rodapé
      const horarioDoc = await db.entities.Configuracao.get('horario').catch(() => null);
      const horario = horarioDoc?.dados?.texto || '';

      // 3. Adicionar assinatura oficial
      const logoUrl = config?.logo_url || 'https://www.djoaoii.com/templates/escola-secundaria-d-joao-ii/images/logo.png';
      const customFooter = config?.footer_html || `
        <div style="font-size: 16px; font-weight: 800; color: #1d4ed8; letter-spacing: -0.01em; margin-bottom: 4px;">ESCOLA SECUNDÁRIA D. JOÃO II</div>
        <div style="font-size: 13px; color: #475569; margin-bottom: 2px;">Rua Dr. Luís Teixeira Macedo e Castro - 2910-514 - Setúbal</div>
        <div style="font-size: 13px; color: #475569; margin-bottom: 2px;">Código 401316</div>
        <div style="font-size: 13px; color: #475569; margin-bottom: 6px;">Telefone: (+351) 265 708 500</div>
        <a href="https://www.djoaoii.com" style="font-size: 13px; color: #2563eb; font-weight: 600; text-decoration: none;">www.djoaoii.com</a>
      `;

      const footer = `
        <div style="margin-top: 48px; padding-top: 24px; border-top: 2px solid #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
          ${horario ? `
            <div style="margin-bottom: 24px; padding: 16px; background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; text-align: center;">
              <div style="font-size: 13px; font-weight: 700; color: #1d4ed8; margin-bottom: 8px;">Horário de Atendimento Administrativo — Provisório</div>
              <div style="font-size: 15px; color: #1e40af; font-weight: 600; margin-bottom: 12px;">${horario.replace(/\n/g, ' | ')}</div>
              <div style="font-size: 12px; color: #3b82f6; line-height: 1.5;">
                Antes de se deslocar, pedimos que confirme a sua visita através dos contactos habituais da escola ou pelo email disponibilizado.
              </div>
            </div>
          ` : ''}

          <table border="0" cellpadding="0" cellspacing="0" style="width: 100%;">
            <tr>
              <td style="width: 120px; vertical-align: middle; padding-right: 24px;">
                <img src="${logoUrl}" alt="Logo" style="width: 100px; height: auto; display: block;">
              </td>
              <td style="border-left: 2px solid #3b82f6; padding-left: 24px; vertical-align: middle;">
                ${customFooter}
              </td>
            </tr>
          </table>
          
          <div style="margin-top: 24px; padding: 12px 0; font-size: 11px; line-height: 1.6; color: #94a3b8;">
            <p style="margin: 0 0 4px 0;">
              <strong>Informação:</strong> Este email foi gerado automaticamente pelo sistema de gestão de material. 
            </p>
            <p style="margin: 0;">
              Se esta mensagem foi útil e legítima, considere marcar como <strong>"Não é spam"</strong>. 
              Ajuda-nos a garantir que comunicações escolares importantes não se percam.
            </p>
          </div>
        </div>
      `;

      const finalBody = `${body}${footer}`;

      // 4. Chamar API
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, to, cc, subject, body: finalBody }),
      });

      let result;
      const text = await response.text();
      
      if (response.status === 404) {
        throw new Error('Serviço de email não encontrado (404). Se estiver a correr localmente, certifique-se que usa "netlify dev" em vez de "npm run dev".');
      }

      try {
        result = JSON.parse(text);
      } catch (e) {
        throw new Error(`Resposta inválida do servidor (${response.status}): ${text.substring(0, 100)}`);
      }

      if (!response.ok) throw new Error(result.error || `Erro ${response.status}: ${result.details || 'Falha no envio'}`);

      // Log success
      await db.entities.EmailHistorico.create({
        pessoa_id,
        destinatario: to,
        assunto: subject,
        conteudo: finalBody,
        tipo,
        status: 'SUCESSO'
      }).catch(err => console.error('Erro ao logar historico:', err));

      return result;
    } catch (error) {
      console.error('EmailService Error:', error);
      
      // Log error (only if we have recipient and subject)
      if (to && subject) {
        // Obter footer mesmo em caso de erro para o log se possível, ou usar body
        const errorLogBody = (typeof body === 'string' && body.length > 0) ? body : 'Sem conteúdo';
        
        await db.entities.EmailHistorico.create({
          pessoa_id,
          destinatario: to,
          assunto: subject,
          conteudo: errorLogBody,
          tipo,
          status: 'ERRO',
          erro: error.message
        }).catch(err => console.error('Erro ao logar historico:', err));
      }
      
      throw error;
    }
  },

  replaceVars(text, vars = {}) {
    let result = text || '';
    Object.entries(vars).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value || '');
    });
    result = result
      .replace(/{{#if[^}]*}}/g, '')
      .replace(/{{\/if}}/g, '')
      .replace(/{{else}}/g, '');
    return result;
  },

  async sendTemplate({ tipo, to, cc, vars = {}, pessoa_id }) {
    // 1. Obter template
    const templates = await db.entities.EmailTemplate.list();
    const template = templates.find(t => t.tipo === tipo);

    if (!template) {
      throw new Error(`Template de email '${tipo}' não encontrado.`);
    }

    // 2. Preparar variáveis
    const allVars = { ...vars };

    // 3. Substituir variáveis no assunto e corpo
    const subject = this.replaceVars(template.assunto, allVars);
    const body = this.replaceVars(template.corpo, allVars);

    // 4. Enviar
    return this.send({ to, cc, subject, body, pessoa_id, tipo });
  }
};
