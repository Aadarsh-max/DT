import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

export const UPLOAD_DIR = fileURLToPath(new URL('../uploads', import.meta.url));
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Keep in sync with ai-engine/app/rag/loader.py and frontend constants.js
export const ALLOWED_EXTENSIONS = [
  '.pdf', '.docx', '.txt', '.md', '.csv', '.json', '.yaml', '.yml', '.xml', '.html', '.htm',
  '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rb', '.php', '.cs',
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(ApiError.badRequest(`Unsupported file type "${ext || 'unknown'}"`));
    }
    cb(null, true);
  },
});

export const uploadRequirementFile = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 15 MB)' : err.message;
      return next(ApiError.badRequest(msg));
    }
    next(err);
  });
};