import nodemailer from 'nodemailer';
import { env } from '../config/environment';
import { logger } from '../utils/logger.util';

interface DailySummaryData {
  alerts: any[];
  consolidated: { total_entries: number; total_clientes: number; total_efectivos: number };
  noReportUsers: any[];
}

export class NotificationEmailService {
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      if (!env.smtp.host) {
        throw new Error('SMTP not configured');
      }
      this.transporter = nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.secure,
        auth: {
          user: env.smtp.user,
          pass: env.smtp.pass,
        },
      });
    }
    return this.transporter;
  }

  async sendDailySummary(recipients: string[], data: DailySummaryData): Promise<void> {
    if (recipients.length === 0) {
      logger.warn('[EMAIL] No recipients for daily summary');
      return;
    }

    try {
      this.getTransporter();
    } catch {
      logger.warn('[EMAIL] SMTP not configured, skipping daily summary email');
      return;
    }

    const today = new Date().toLocaleDateString('es-CO', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const criticalAlerts = data.alerts.filter(a => a.severity === 'CRITICAL');
    const warningAlerts = data.alerts.filter(a => a.severity === 'WARNING');
    const infoAlerts = data.alerts.filter(a => a.severity === 'INFO');

    const efectividad = data.consolidated.total_clientes > 0
      ? ((data.consolidated.total_efectivos / data.consolidated.total_clientes) * 100).toFixed(1)
      : '0';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; }
        .header { background: #1a237e; color: #fff; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; }
        .body { padding: 24px; }
        .kpi-row { display: flex; gap: 12px; margin-bottom: 20px; }
        .kpi-card { flex: 1; background: #f8f9fa; border-radius: 6px; padding: 16px; text-align: center; }
        .kpi-card .value { font-size: 28px; font-weight: 700; color: #1a237e; }
        .kpi-card .label { font-size: 12px; color: #666; margin-top: 4px; }
        .section { margin-bottom: 20px; }
        .section h3 { margin: 0 0 12px 0; font-size: 16px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px; }
        .alert-item { padding: 10px 12px; margin-bottom: 6px; border-radius: 4px; font-size: 14px; }
        .alert-critical { background: #ffebee; border-left: 4px solid #f44336; }
        .alert-warning { background: #fff3e0; border-left: 4px solid #ff9800; }
        .alert-info { background: #e3f2fd; border-left: 4px solid #2196f3; }
        .no-report { background: #fafafa; padding: 8px 12px; margin-bottom: 4px; border-radius: 4px; font-size: 14px; }
        .footer { background: #f5f5f5; padding: 16px; text-align: center; font-size: 12px; color: #999; }
        .badge { display: inline-block; color: #fff; border-radius: 12px; padding: 2px 10px; font-size: 12px; font-weight: 600; }
        .badge-critical { background: #f44336; }
        .badge-warning { background: #ff9800; }
        .badge-info { background: #2196f3; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Resumen Diario - Pautas</h1>
          <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${today}</p>
        </div>
        <div class="body">
          <table width="100%" cellspacing="8" style="margin-bottom: 20px;">
            <tr>
              <td style="background: #f8f9fa; border-radius: 6px; padding: 16px; text-align: center;">
                <div style="font-size: 28px; font-weight: 700; color: #1a237e;">${data.consolidated.total_entries}</div>
                <div style="font-size: 12px; color: #666;">Reportes</div>
              </td>
              <td style="background: #f8f9fa; border-radius: 6px; padding: 16px; text-align: center;">
                <div style="font-size: 28px; font-weight: 700; color: #1a237e;">${data.consolidated.total_clientes}</div>
                <div style="font-size: 12px; color: #666;">Clientes</div>
              </td>
              <td style="background: #f8f9fa; border-radius: 6px; padding: 16px; text-align: center;">
                <div style="font-size: 28px; font-weight: 700; color: #1a237e;">${efectividad}%</div>
                <div style="font-size: 12px; color: #666;">Efectividad</div>
              </td>
            </tr>
          </table>

          <div class="section">
            <h3>Alertas del Día
              <span class="badge badge-critical">${criticalAlerts.length}</span>
              <span class="badge badge-warning">${warningAlerts.length}</span>
              <span class="badge badge-info">${infoAlerts.length}</span>
            </h3>
            ${criticalAlerts.length === 0 && warningAlerts.length === 0 && infoAlerts.length === 0
              ? '<p style="color: #4caf50; font-size: 14px;">Sin alertas hoy.</p>'
              : ''}
            ${criticalAlerts.map(a => `<div class="alert-item alert-critical"><strong>${a.title}</strong> — ${a.message}</div>`).join('')}
            ${warningAlerts.map(a => `<div class="alert-item alert-warning"><strong>${a.title}</strong> — ${a.message}</div>`).join('')}
            ${infoAlerts.map(a => `<div class="alert-item alert-info"><strong>${a.title}</strong> — ${a.message}</div>`).join('')}
          </div>

          ${data.noReportUsers.length > 0 ? `
          <div class="section">
            <h3>Sin Reporte Hoy (${data.noReportUsers.length})</h3>
            ${data.noReportUsers.map(u => `<div class="no-report">${u.full_name} — ${u.country_name}</div>`).join('')}
          </div>
          ` : ''}
        </div>
        <div class="footer">
          Pautas — Sistema de Gestión de Campañas<br>
          Este es un email automático, no responder.
        </div>
      </div>
    </body>
    </html>
    `;

    try {
      await this.transporter!.sendMail({
        from: env.smtp.from || env.smtp.user,
        to: recipients.join(', '),
        subject: `[Pautas] Resumen Diario — ${new Date().toISOString().split('T')[0]}`,
        html,
      });
      logger.info(`[EMAIL] Daily summary sent to ${recipients.length} recipient(s)`);
    } catch (error: any) {
      logger.error(`[EMAIL] Failed to send daily summary: ${error.message}`);
    }
  }
}

export const notificationEmailService = new NotificationEmailService();
