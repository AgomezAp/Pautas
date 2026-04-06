import ExcelJS from 'exceljs';
import { query } from '../config/database';

export class ExportExcelService {
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
    if (filters.iso_year) {
      conditions.push(`de.iso_year = $${paramIndex++}`);
      params.push(parseInt(filters.iso_year));
    }
    if (filters.iso_week) {
      conditions.push(`de.iso_week = $${paramIndex++}`);
      params.push(parseInt(filters.iso_week));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT de.entry_date, de.iso_year, de.iso_week,
              de.clientes, de.clientes_efectivos, de.menores,
              u.full_name as usuario,
              c.name as pais,
              camp.name as campana,
              gas.conversions, gas.status as estado_ads,
              gas.remaining_budget as presupuesto_restante, gas.cost as costo_ads,
              CASE WHEN de.clientes > 0
                THEN ROUND(de.clientes_efectivos::numeric / de.clientes::numeric, 4)
                ELSE 0 END as tasa_efectividad,
              CASE WHEN de.clientes > 0 AND gas.conversions IS NOT NULL
                THEN ROUND(gas.conversions::numeric / de.clientes::numeric, 4)
                ELSE 0 END as tasa_conversion
       FROM daily_entries de
       JOIN users u ON u.id = de.user_id
       JOIN countries c ON c.id = de.country_id
       LEFT JOIN campaigns camp ON camp.id = de.campaign_id
       LEFT JOIN google_ads_snapshots gas ON gas.campaign_id = de.campaign_id AND gas.snapshot_date = de.entry_date
       ${whereClause}
       ORDER BY de.entry_date DESC, u.full_name`,
      params
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Pautas Platform';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Reporte Consolidado');

    // Header style
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A237E' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      },
    };

    sheet.columns = [
      { header: 'Fecha', key: 'entry_date', width: 14 },
      { header: 'País', key: 'pais', width: 15 },
      { header: 'Usuario', key: 'usuario', width: 25 },
      { header: 'Campaña', key: 'campana', width: 30 },
      { header: 'Clientes', key: 'clientes', width: 12 },
      { header: 'Clientes Efectivos', key: 'clientes_efectivos', width: 18 },
      { header: 'Menores', key: 'menores', width: 12 },
      { header: 'Conversiones', key: 'conversions', width: 15 },
      { header: 'Estado Ads', key: 'estado_ads', width: 14 },
      { header: 'Presupuesto Rest.', key: 'presupuesto_restante', width: 18 },
      { header: 'Costo Ads', key: 'costo_ads', width: 14 },
      { header: 'Tasa Efectividad', key: 'tasa_efectividad', width: 18 },
      { header: 'Tasa Conversión', key: 'tasa_conversion', width: 18 },
      { header: 'Semana ISO', key: 'iso_week', width: 12 },
    ];

    // Apply header style
    sheet.getRow(1).eachCell(cell => {
      cell.style = headerStyle;
    });

    // Add data rows
    result.rows.forEach(row => {
      sheet.addRow({
        entry_date: row.entry_date,
        pais: row.pais,
        usuario: row.usuario,
        campana: row.campana || '-',
        clientes: parseInt(row.clientes),
        clientes_efectivos: parseInt(row.clientes_efectivos),
        menores: parseInt(row.menores),
        conversions: row.conversions ? parseFloat(row.conversions) : '-',
        estado_ads: row.estado_ads || '-',
        presupuesto_restante: row.presupuesto_restante ? parseFloat(row.presupuesto_restante) : '-',
        costo_ads: row.costo_ads ? parseFloat(row.costo_ads) : '-',
        tasa_efectividad: parseFloat(row.tasa_efectividad),
        tasa_conversion: parseFloat(row.tasa_conversion),
        iso_week: `S${row.iso_week}`,
      });
    });

    // Auto-filter
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: result.rows.length + 1, column: 14 },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

export const exportExcelService = new ExportExcelService();
