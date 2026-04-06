import PdfPrinter from 'pdfmake';
import { query } from '../config/database';

const fonts = {
  Roboto: {
    normal: 'node_modules/pdfmake/build/vfs_fonts.js',
  },
};

export class ExportPdfService {
  async generateConsolidatedReport(filters: any): Promise<Buffer> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.country_id) {
      conditions.push(`de.country_id = $${paramIndex++}`);
      params.push(parseInt(filters.country_id));
    }
    if (filters.date_from) {
      conditions.push(`de.entry_date >= $${paramIndex++}`);
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      conditions.push(`de.entry_date <= $${paramIndex++}`);
      params.push(filters.date_to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT de.entry_date, de.clientes, de.clientes_efectivos, de.menores,
              u.full_name as usuario, c.name as pais, camp.name as campana,
              gas.conversions
       FROM daily_entries de
       JOIN users u ON u.id = de.user_id
       JOIN countries c ON c.id = de.country_id
       LEFT JOIN campaigns camp ON camp.id = de.campaign_id
       LEFT JOIN google_ads_snapshots gas ON gas.campaign_id = de.campaign_id AND gas.snapshot_date = de.entry_date
       ${whereClause}
       ORDER BY de.entry_date DESC
       LIMIT 500`,
      params
    );

    const tableBody = [
      [
        { text: 'Fecha', style: 'tableHeader' },
        { text: 'País', style: 'tableHeader' },
        { text: 'Usuario', style: 'tableHeader' },
        { text: 'Campaña', style: 'tableHeader' },
        { text: 'Clientes', style: 'tableHeader' },
        { text: 'Efectivos', style: 'tableHeader' },
        { text: 'Conversiones', style: 'tableHeader' },
      ],
      ...result.rows.map(row => [
        row.entry_date,
        row.pais,
        row.usuario,
        row.campana || '-',
        row.clientes.toString(),
        row.clientes_efectivos.toString(),
        row.conversions ? row.conversions.toString() : '-',
      ]),
    ];

    const docDefinition: any = {
      pageOrientation: 'landscape',
      content: [
        { text: 'Reporte Consolidado - Pautas', style: 'header' },
        { text: `Generado: ${new Date().toLocaleString('es-CO')}`, style: 'subheader' },
        { text: ' ' },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', '*', '*', 'auto', 'auto', 'auto'],
            body: tableBody,
          },
          layout: 'lightHorizontalLines',
        },
      ],
      styles: {
        header: { fontSize: 18, bold: true, color: '#1a237e', margin: [0, 0, 0, 8] },
        subheader: { fontSize: 10, color: '#666', margin: [0, 0, 0, 16] },
        tableHeader: { bold: true, fontSize: 9, color: 'white', fillColor: '#1a237e' },
      },
      defaultStyle: { fontSize: 8 },
    };

    return new Promise((resolve, reject) => {
      try {
        const printer = new PdfPrinter(fonts as any);
        const doc = printer.createPdfKitDocument(docDefinition);
        const chunks: any[] = [];
        doc.on('data', (chunk: any) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

export const exportPdfService = new ExportPdfService();
