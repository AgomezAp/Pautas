import { Request, Response, NextFunction } from 'express';
import { gestionService } from './gestion.service';
import { sendSuccess, sendCreated, sendError } from '../../utils/response.util';
import { exportExcelService } from '../../services/export-excel.service';
import { exportPdfService } from '../../services/export-pdf.service';
import { campaignRotationService } from './campaign-rotation.service';

export class GestionController {
  async getDashboardKpis(req: Request, res: Response, next: NextFunction) {
    try {
      const kpis = await gestionService.getDashboardKpis(req.query);
      return sendSuccess(res, kpis);
    } catch (err) { next(err); }
  }

  async getEffectivenessReport(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await gestionService.getEffectivenessReport(req.query);
      return sendSuccess(res, report);
    } catch (err) { next(err); }
  }

  async getConversionReport(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await gestionService.getConversionReport(req.query);
      return sendSuccess(res, report);
    } catch (err) { next(err); }
  }

  async getByCountryReport(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await gestionService.getByCountryReport();
      return sendSuccess(res, report);
    } catch (err) { next(err); }
  }

  async getByWeekReport(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await gestionService.getByWeekReport(req.query);
      return sendSuccess(res, report);
    } catch (err) { next(err); }
  }

  async exportExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const buffer = await exportExcelService.generateConsolidatedReport(req.query);
      const filename = `reporte_gestion_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (err) { next(err); }
  }

  async exportPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const buffer = await exportPdfService.generateConsolidatedReport(req.query);
      const filename = `reporte_gestion_${new Date().toISOString().split('T')[0]}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (err) { next(err); }
  }

  // Campaign rotation endpoints
  async rotateCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      const { campaign_id, new_user_id, reason, effective_date } = req.body;
      if (!campaign_id || !new_user_id) {
        return sendError(res, 'VALIDATION_ERROR', 'campaign_id y new_user_id son requeridos', 400);
      }
      const rotation = await campaignRotationService.rotateCampaign(
        parseInt(campaign_id),
        parseInt(new_user_id),
        req.user!.sub,
        reason || null,
        effective_date || null,
        req.ip
      );
      return sendCreated(res, rotation);
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      next(err);
    }
  }

  async getRotationHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await campaignRotationService.getRotationHistory(req.query);
      return sendSuccess(res, result.data, result.meta);
    } catch (err) { next(err); }
  }

  async getAvailableUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const countryId = req.query.country_id ? parseInt(req.query.country_id as string) : undefined;
      const users = await campaignRotationService.getAvailableConglomeradoUsers(countryId);
      return sendSuccess(res, users);
    } catch (err) { next(err); }
  }

  async getActiveCampaigns(req: Request, res: Response, next: NextFunction) {
    try {
      const countryId = req.query.country_id ? parseInt(req.query.country_id as string) : undefined;
      const campaigns = await campaignRotationService.getActiveCampaigns(countryId);
      return sendSuccess(res, campaigns);
    } catch (err) { next(err); }
  }

  async getConglomeradoUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const countryId = req.query.country_id ? parseInt(req.query.country_id as string) : undefined;
      const users = await gestionService.getConglomeradoUsers(countryId);
      return sendSuccess(res, users);
    } catch (err) { next(err); }
  }

  async updateConglomeradoGoogleAdsAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(req.params.id);
      const { google_ads_account_id } = req.body;
      await gestionService.updateGoogleAdsAccount(userId, google_ads_account_id || null);
      return sendSuccess(res, { message: 'Cuenta de Google Ads actualizada' });
    } catch (err) { next(err); }
  }

  async getEntriesWithImages(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await gestionService.getEntriesWithImages(req.query);
      return sendSuccess(res, result.data);
    } catch (err) { next(err); }
  }

  async createConglomeradoUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, full_name, email, password, country_id, campaign_id } = req.body;
      const user = await gestionService.createConglomeradoUser(
        { username, full_name, email, password, country_id, campaign_id },
        req.user!.sub,
        req.ip
      );
      return sendCreated(res, user);
    } catch (err: any) {
      if (err.code === '23505') {
        return sendError(res, 'DUPLICATE_ENTRY', 'El username o email ya existe', 409);
      }
      if (err.status) return sendError(res, err.code, err.message, err.status);
      next(err);
    }
  }

  async resetEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const entryId = parseInt(req.params.entryId);
      if (isNaN(entryId)) {
        return sendError(res, 'VALIDATION_ERROR', 'ID de entrada inválido', 400);
      }
      const result = await gestionService.resetEntry(entryId, req.user!.sub, req.ip);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      next(err);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return sendError(res, 'VALIDATION_ERROR', 'ID de usuario inválido', 400);
      }
      const { new_password } = req.body;
      if (!new_password || new_password.length < 6) {
        return sendError(res, 'VALIDATION_ERROR', 'La contraseña debe tener al menos 6 caracteres', 400);
      }
      const result = await gestionService.resetPassword(userId, new_password, req.user!.sub, req.ip);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      next(err);
    }
  }

  // ─── User Countries ───────────────────────────────────────────────────────

  async getUserCountries(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(req.params.userId);
      const countries = await gestionService.getUserCountries(userId);
      return sendSuccess(res, countries);
    } catch (err) { next(err); }
  }

  async setUserCountries(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(req.params.userId);
      const { country_ids } = req.body;
      if (!Array.isArray(country_ids)) {
        return sendError(res, 'VALIDATION_ERROR', 'country_ids debe ser un arreglo', 400);
      }
      await gestionService.setUserCountries(userId, country_ids.map(Number), req.user!.sub, req.ip);
      return sendSuccess(res, { updated: true });
    } catch (err) { next(err); }
  }

  // ─── Master Evaluations (Hoja de vida) ───────────────────────────────────

  async getMasterList(req: Request, res: Response, next: NextFunction) {
    try {
      const countryId = req.query['country_id'] ? parseInt(req.query['country_id'] as string) : undefined;
      const list = await gestionService.getMasterList({ countryId });
      return sendSuccess(res, list);
    } catch (err) { next(err); }
  }

  async getMasterEvaluations(req: Request, res: Response, next: NextFunction) {
    try {
      const masterUserId = parseInt(req.params.masterUserId);
      const evals = await gestionService.getMasterEvaluations(masterUserId);
      return sendSuccess(res, evals);
    } catch (err) { next(err); }
  }

  async createMasterEvaluation(req: Request, res: Response, next: NextFunction) {
    try {
      const masterUserId = parseInt(req.params.masterUserId);
      const { type, title, description, numeric_rating, phone_number, campaign_change_date } = req.body;
      const validTypes = ['evaluation', 'incident', 'campaign_change', 'phone_history'];
      if (!validTypes.includes(type)) {
        return sendError(res, 'VALIDATION_ERROR', `Tipo inválido. Válidos: ${validTypes.join(', ')}`, 400);
      }
      const evaluation = await gestionService.createMasterEvaluation({
        masterUserId,
        createdBy: req.user!.sub,
        type,
        title,
        description,
        numericRating: numeric_rating ? parseInt(numeric_rating) : undefined,
        phoneNumber: phone_number,
        campaignChangeDate: campaign_change_date,
      });
      return sendCreated(res, evaluation);
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      next(err);
    }
  }

  async deleteMasterEvaluation(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.evalId);
      await gestionService.deleteMasterEvaluation(id, req.user!.sub);
      return sendSuccess(res, { deleted: true });
    } catch (err: any) {
      if (err.status) return sendError(res, err.code, err.message, err.status);
      next(err);
    }
  }
}

export const gestionController = new GestionController();
