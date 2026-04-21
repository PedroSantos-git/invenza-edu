const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { config, to, cc, subject, body } = JSON.parse(event.body);

    if (!config || !config.host || !config.user || !config.pass) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Configuração SMTP incompleta.' }) 
      };
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: parseInt(config.port) || 587,
      secure: config.port == 465, // true for 465, false for other ports
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from: `"KIT Informático" <${config.user}>`,
      replyTo: config.user,
      to,
      cc,
      subject,
      html: body,
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Email enviado com sucesso!', info }),
    };
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro ao enviar email.', details: error.message }),
    };
  }
};
