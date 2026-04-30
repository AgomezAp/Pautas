import { Request, Response, NextFunction } from 'express';
import { conglomeradoService } from './conglomerado.service';
import { sendSuccess, sendCreated, sendError } from '../../utils/response.util';
import { imageProcessingService } from '../../services/image-processing.service';
import { weeklySummaryService } from '../../services/weekly-summary.service';
import { alertsEngineService } from '../../services/alerts-engine.service';
import { logger } from '../../utils/logger.util';
import { toRelativeImagePath } from '../../utils/image-path.util';

export class ConglomeradoController {
  async checkToday(req: Request, res: Response, next: NextFunction) {
    try {
      const entry = await conglomeradoService.checkTodayEntry(req.user!.sub);
      return sendSuccess(res, { submitted: !!entry, entry });
    } catch (err) { next(err); }
  }

  async createEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const { clientes, clientes_efectivos, menores, cierre } = req.body;
      const allFiles = req.files as { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[];

      // Support both array (single field) and object (multiple fields) from multer
      const soporteFiles: Express.Multer.File[] = Array.isArray(allFiles)
        ? allFiles.filter((f: Express.Multer.File) => f.fieldname === 'soporte')
        : (allFiles as any)['soporte'] || [];
      const voucherFiles: Express.Multer.File[] = Array.isArray(allFiles)
        ? allFiles.filter((f: Express.Multer.File) => f.fieldname === 'vouchers')
        : (allFiles as any)['vouchers'] || [];

      const processFiles = async (files: Express.Multer.File[]) => {
        const result: { imagePath: string; originalName: string; thumbPath: string | null }[] = [];
        for (const file of files) {
          let imagePath = file.path.replace(/\\/g, '/');
          let thumbPath: string | null = null;
          const originalName = file.originalname;
          try {
            const processed = await imageProcessingService.processUploadedImage(imagePath);
            imagePath = processed.mainPath.replace(/\\/g, '/');
            thumbPath = processed.thumbPath ? processed.thumbPath.replace(/\\/g, '/') : null;
          } catch (imgErr: any) {
            logger.warn(`Image processing failed, using original: ${imgErr.message}`);
          }
          result.push({
            imagePath: toRelativeImagePath(imagePath),
            originalName,
            thumbPath: thumbPath ? toRelativeImagePath(thumbPath) : null,
          });
        }
        return result;
      };

      const images = await processFiles(soporteFiles);
      const vouchers = await processFiles(voucherFiles);

      const entry = await conglomeradoService.createEntry(
        req.user!.sub,
        req.user!.countryId!,
        req.user!.campaignId,
        {
          clientes: parseInt(clientes),
          clientes_efectivos: parseInt(clientes_efectivos),
          menores: parseInt(menores),
          cierre: cierre !== undefined && cierre !== '' ? parseFloat(cierre) : null,
        },
        images,
        vouchers,
        req.ip
      );

      // Async: Compute weekly summary (non-blocking)
      weeklySummaryService.computeForEntry({
        country_id: entry.country_id,
        campaign_id: entry.campaign_id,
        user_id: entry.user_id,
        iso_year: entry.iso_year,
        iso_week: entry.iso_week,
      }).catch((err: any) => {
        logger.error(`Weekly summary compute failed for entry ${entry.id}: ${err.message}`);
      });

      // Async: Evaluate alerts engine (non-blocking)
      alertsEngineService.evaluateEntry({
        id: entry.id,
        user_id: entry.user_id,
        country_id: entry.country_id,
        campaign_id: entry.campaign_id,
        clientes: parseInt(clientes),
        clientes_efectivos: parseInt(clientes_efectivos),
        menores: parseInt(menores),
        entry_date: entry.entry_date,
        iso_year: entry.iso_year,
        iso_week: entry.iso_week,
      }).catch((err: any) => {
        logger.error(`Alerts evaluation failed for entry ${entry.id}: ${err.message}`);
      });

      return sendCreated(res, entry);
    } catch (err: any) {
      if (err.code === '23505') {
        return sendError(res, 'DUPLICATE_ENTRY', 'Ya existe una entrada para el día de hoy', 409);
      }
      if (err.status) return sendError(res, err.code, err.message, err.status);
      next(err);
    }
  }

  async getEntries(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await conglomeradoService.getEntries(req.user!.sub, req.query);
      return sendSuccess(res, result.data, result.meta);
    } catch (err) { next(err); }
  }

  async getEntryById(req: Request, res: Response, next: NextFunction) {
    try {
      const entry = await conglomeradoService.getEntryById(parseInt(req.params.id), req.user!.sub);
      return sendSuccess(res, entry);
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      next(err);
    }
  }

  async getWeeklySummary(req: Request, res: Response, next: NextFunction) {
    try {
      const isoYear = req.query.iso_year ? parseInt(req.query.iso_year as string) : undefined;
      const isoWeek = req.query.iso_week ? parseInt(req.query.iso_week as string) : undefined;
      const summary = await conglomeradoService.getWeeklySummary(req.user!.sub, isoYear, isoWeek);
      return sendSuccess(res, summary);
    } catch (err) { next(err); }
  }
}

export const conglomeradoController = new ConglomeradoController();
