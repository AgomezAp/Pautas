import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger.util';

export class ImageProcessingService {
  async processUploadedImage(filePath: string): Promise<{ mainPath: string; thumbPath: string }> {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);
    const thumbPath = path.join(dir, `${baseName}_thumb${ext}`);

    try {
      // Resize main image to max 1920px width
      const image = sharp(filePath);
      const metadata = await image.metadata();

      if (metadata.width && metadata.width > 1920) {
        const buffer = await image
          .resize(1920, null, { withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
        fs.writeFileSync(filePath, buffer);
      }

      // Generate thumbnail 200x200
      await sharp(filePath)
        .resize(200, 200, { fit: 'cover' })
        .jpeg({ quality: 70 })
        .toFile(thumbPath);

      logger.debug(`Image processed: ${filePath}`);
      return { mainPath: filePath, thumbPath };
    } catch (error: any) {
      logger.error(`Image processing failed for ${filePath}: ${error.message}`);
      return { mainPath: filePath, thumbPath: filePath };
    }
  }
}

export const imageProcessingService = new ImageProcessingService();
