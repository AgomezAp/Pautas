import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/environment';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const now = new Date();
    const dir = path.join(
      path.resolve(env.upload.dir),
      'soporte',
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    );
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.sub || 0;
    const uniqueSuffix = uuidv4().substring(0, 8);
    const ext = path.extname(file.originalname);
    cb(null, `user_${userId}_${Date.now()}_${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req: any, file: any, cb: any) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen (JPEG, PNG, WebP, GIF)'), false);
  }
};

export const uploadSoporte = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.upload.maxFileSizeMB * 1024 * 1024 },
}).array('soporte', 10);

// Accepts both soporte images and payment vouchers in a single request
export const uploadEntryFiles = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.upload.maxFileSizeMB * 1024 * 1024 },
}).fields([
  { name: 'soporte', maxCount: 10 },
  { name: 'vouchers', maxCount: 10 },
]);

export const uploadAdsFile = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(path.resolve(env.upload.dir), 'ads-imports');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = uuidv4().substring(0, 8);
      const ext = path.extname(file.originalname);
      cb(null, `ads_import_${Date.now()}_${uniqueSuffix}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for spreadsheets
}).single('file');
