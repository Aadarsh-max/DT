import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
import { UPLOAD_DIR } from './upload.middleware.js';

export const APK_DIR = path.join(UPLOAD_DIR, 'apks');
export const APK_INCOMING = path.join(APK_DIR, '_incoming');
export const MAX_APK_MB = 250;
fs.mkdirSync(APK_INCOMING, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, APK_INCOMING),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.apk`),
  }),
  limits: { fileSize: MAX_APK_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.apk') {
      return cb(ApiError.badRequest('Only .apk files can be uploaded here'));
    }
    cb(null, true);
  },
});

export const uploadApk = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? `The APK is too large (max ${MAX_APK_MB} MB)` : err.message;
      return next(ApiError.badRequest(msg));
    }
    next(err);
  });
};