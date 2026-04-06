import { Request, Response, NextFunction } from 'express';
import { conglomeradoService } from './conglomerado.service';
import { sendSuccess, sendCreated, sendError } from '../../utils/response.util';
import { imageProcessingService } from '../../services/image-processing.service';
import { weeklySummaryService } from '../../services/weekly-summary.service';
import { alertsEngineService } from '../../services/alerts-engine.service';
import { logger } from '../../utils/logger.util';

export class ConglomeradoController {
  async checkToday(req: Request, res: Response, next: NextFunction) {
    try {
      const entry = await conglomeradoService.checkTodayEntry(req.user!.sub);
      return sendSuccess(res, { submitted: !!entry, entry });
    } catch (err) { next(err); }
  }

  async createEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const { clientes, clientes_efectivos, menores } = req.body;
      let imagePath = req.file ? req.file.path.replace(/\\/g, '/') : null;
      const originalName = req.file ? req.file.originalname : null;

      // Process uploaded image (resize + thumbnail)
      if (imagePath) {
        try {
          const processed = await imageProcessingService.processUploadedImage(imagePath);
          imagePath = processed.mainPath.replace(/\\/g, '/');
        } catch (imgErr: any) {
          logger.warn(`Image processing failed, using original: ${imgErr.message}`);
        }
      }

      const entry = await conglomeradoService.createEntry(
        req.user!.sub,
        req.user!.countryId!,
        req.user!.campaignId,
        { clientes: parseInt(clientes), clientes_efectivos: parseInt(clientes_efectivos), menores: parseInt(menores) },
        imagePath,
        originalName,
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
