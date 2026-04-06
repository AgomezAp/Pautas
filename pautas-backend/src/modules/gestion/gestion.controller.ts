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
      return sendSuccess(res, result.data, result.meta);
    } catch (err) { next(err); }
  }
}

export const gestionController = new GestionController();
