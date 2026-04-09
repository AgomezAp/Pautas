import fs from 'fs';
import path from 'path';
import { query } from '../config/database';
import { logger } from '../utils/logger.util';
import { env } from '../config/environment';

export class ImageCleanupService {
  private readonly retentionDays = 14;

  /**
   * Deletes images older than 14 days from both the database and filesystem.
   * Steps:
   *   1. Find entry_images rows where the parent daily_entry is older than 14 days
   *   2. Delete the physical files from disk
   *   3. Remove the DB rows
   *   4. Also clean legacy soporte_image_path in daily_entries
   */
  async cleanupOldImages(): Promise<{ deletedFiles: number; errors: number }> {
    let deletedFiles = 0;
    let errors = 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
    const cutoff = cutoffDate.toISOString().split('T')[0];

    // 1. Get old images from entry_images table
    const result = await query(
      `SELECT ei.id, ei.image_path, ei.thumb_path
       FROM entry_images ei
       JOIN daily_entries de ON de.id = ei.entry_id
       WHERE de.entry_date < $1`,
      [cutoff]
    );

    const uploadBase = path.resolve(env.upload.dir);

    for (const row of result.rows) {
      // Delete main image file
      if (row.image_path) {
        const filePath = this.resolveFilePath(uploadBase, row.image_path);
        deletedFiles += this.deleteFile(filePath);
      }

      // Delete thumbnail file
      if (row.thumb_path) {
        const thumbPath = this.resolveFilePath(uploadBase, row.thumb_path);
        deletedFiles += this.deleteFile(thumbPath);
      }
    }

    // Delete DB rows for old images
    if (result.rows.length > 0) {
      const ids = result.rows.map((r: any) => r.id);
      try {
        await query(
          `DELETE FROM entry_images WHERE id = ANY($1::int[])`,
          [ids]
        );
        logger.info(`[IMAGE_CLEANUP] Deleted ${ids.length} entry_images rows`);
      } catch (err: any) {
        logger.error(`[IMAGE_CLEANUP] DB delete error: ${err.message}`);
        errors++;
      }
    }

    // 2. Handle legacy soporte_image_path column
    const legacyResult = await query(
      `SELECT id, soporte_image_path FROM daily_entries
       WHERE entry_date < $1 AND soporte_image_path IS NOT NULL`,
      [cutoff]
    );

    for (const row of legacyResult.rows) {
      const filePath = this.resolveFilePath(uploadBase, row.soporte_image_path);
      deletedFiles += this.deleteFile(filePath);
    }

    if (legacyResult.rows.length > 0) {
      try {
        await query(
          `UPDATE daily_entries SET soporte_image_path = NULL
           WHERE entry_date < $1 AND soporte_image_path IS NOT NULL`,
          [cutoff]
        );
        logger.info(`[IMAGE_CLEANUP] Cleared ${legacyResult.rows.length} legacy soporte_image_path values`);
      } catch (err: any) {
        logger.error(`[IMAGE_CLEANUP] Legacy cleanup error: ${err.message}`);
        errors++;
      }
    }

    // 3. Clean up empty date directories
    this.cleanEmptyDirs(path.join(uploadBase, 'soporte'));

    return { deletedFiles, errors };
  }

  resolveFilePath(uploadBase: string, imagePath: string): string {
    // If path starts with "uploads/", strip that prefix since uploadBase already points to uploads dir
    const normalized = imagePath.replace(/\\/g, '/');
    if (normalized.startsWith('uploads/')) {
      return path.join(uploadBase, '..', normalized);
    }
    return path.resolve(normalized);
  }

  deleteFile(filePath: string): number {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return 1;
      }
    } catch (err: any) {
      logger.warn(`[IMAGE_CLEANUP] Failed to delete ${filePath}: ${err.message}`);
    }
    return 0;
  }

  private cleanEmptyDirs(dirPath: string): void {
    try {
      if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return;

      const entries = fs.readdirSync(dirPath);
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        if (fs.statSync(fullPath).isDirectory()) {
          this.cleanEmptyDirs(fullPath);
        }
      }

      // Re-read after recursive cleanup
      if (fs.readdirSync(dirPath).length === 0) {
        fs.rmdirSync(dirPath);
      }
    } catch (err: any) {
      logger.warn(`[IMAGE_CLEANUP] Failed to clean dir ${dirPath}: ${err.message}`);
    }
  }
}

export const imageCleanupService = new ImageCleanupService();
