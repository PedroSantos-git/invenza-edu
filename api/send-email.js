import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { config, to, cc, subject, body } = req.body;

    if (!config || !config.host || !config.user || !config.pass) {
      return res.status(400).json({ error: 'Configuração SMTP incompleta.' });
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: parseInt(config.port) || 587,
      secure: config.port == 465,
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

    return res.status(200).json({ message: 'Email enviado com sucesso!', info });
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    return res.status(500).json({ error: 'Erro ao enviar email.', details: error.message });
  }
}
