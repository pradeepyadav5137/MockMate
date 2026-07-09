/**
 * Storage service with local and S3 drivers.
 * Local: development only.
 * S3: production — private storage with signed URLs.
 * SECURITY: Never falls back to local in production.
 */
const fs = require('fs');
const path = require('path');
const fsPromises = fs.promises;

const DRIVER = process.env.STORAGE_DRIVER || 'local';
const BASE_PATH = path.resolve(__dirname, '..', process.env.STORAGE_BASE_PATH || './storage');

if (DRIVER === 'local') {
  ['resumes', 'recordings', 'feedback-reports'].forEach((dir) => {
    fs.mkdirSync(path.join(BASE_PATH, dir), { recursive: true });
  });
}

// ── S3 Helpers (lazy-loaded) ────────────────────────────────────────────
function getS3Helpers() {
  const { getS3Client } = require('../config/s3');
  const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  return { getS3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, getSignedUrl };
}

const S3_BUCKET = () => process.env.S3_BUCKET_NAME;
const s3Key = (prefix, id, filename) => `${prefix}/${id}/${filename}`;

// ── Path traversal protection ───────────────────────────────────────────
function sanitizeId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '');
}

function sanitizeFilename(filename) {
  return String(filename).replace(/[^a-zA-Z0-9._-]/g, '');
}

// ── Upload Resume ───────────────────────────────────────────────────────
const uploadResume = async (fileBuffer, filename, userId) => {
  const safeUserId = sanitizeId(userId);
  const safeFilename = sanitizeFilename(filename);

  if (DRIVER === 's3') {
    try {
      const { getS3Client, PutObjectCommand } = getS3Helpers();
      const key = s3Key('resumes', safeUserId, safeFilename);
      await getS3Client().send(new PutObjectCommand({
        Bucket: S3_BUCKET(),
        Key: key,
        Body: fileBuffer,
        ContentType: 'application/pdf',
      }));
      return { success: true, url: `/api/storage/resumes/${safeUserId}/${safeFilename}`, path: key };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  if (DRIVER === 'local') {
    try {
      const userDir = path.join(BASE_PATH, 'resumes', safeUserId);
      await fsPromises.mkdir(userDir, { recursive: true });
      const filePath = path.join(userDir, safeFilename);
      await fsPromises.writeFile(filePath, fileBuffer);
      return { success: true, url: `/api/storage/resumes/${safeUserId}/${safeFilename}`, path: filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: `Driver ${DRIVER} not implemented for uploadResume` };
};

// ── Save Recording ──────────────────────────────────────────────────────
const saveRecording = async (fileBuffer, filename, interviewId) => {
  const safeId = sanitizeId(interviewId);
  const safeFilename = sanitizeFilename(filename);

  if (DRIVER === 's3') {
    try {
      const { getS3Client, PutObjectCommand } = getS3Helpers();
      const key = s3Key('recordings', safeId, safeFilename);
      const ext = path.extname(safeFilename).toLowerCase();
      const mimeMap = { '.webm': 'audio/webm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
      await getS3Client().send(new PutObjectCommand({
        Bucket: S3_BUCKET(),
        Key: key,
        Body: fileBuffer,
        ContentType: mimeMap[ext] || 'audio/webm',
        // Private: no public access
      }));
      return { success: true, url: `/api/storage/recordings/${safeId}/stream`, path: key };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  if (DRIVER === 'local') {
    try {
      const interviewDir = path.join(BASE_PATH, 'recordings', safeId);
      await fsPromises.mkdir(interviewDir, { recursive: true });
      const filePath = path.join(interviewDir, safeFilename);
      await fsPromises.writeFile(filePath, fileBuffer);
      return { success: true, url: `/api/storage/recordings/${safeId}/stream`, path: filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: `Driver ${DRIVER} not implemented for saveRecording` };
};

// ── Save Feedback Report ────────────────────────────────────────────────
const saveFeedbackReport = async (pdfBuffer, interviewId) => {
  const safeId = sanitizeId(interviewId);

  if (DRIVER === 's3') {
    try {
      const { getS3Client, PutObjectCommand } = getS3Helpers();
      const key = s3Key('feedback-reports', safeId, 'report.pdf');
      await getS3Client().send(new PutObjectCommand({
        Bucket: S3_BUCKET(),
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      }));
      return { success: true, url: `/api/storage/feedback-reports/${safeId}/report.pdf`, path: key };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  if (DRIVER === 'local') {
    try {
      const interviewDir = path.join(BASE_PATH, 'feedback-reports', safeId);
      await fsPromises.mkdir(interviewDir, { recursive: true });
      const filePath = path.join(interviewDir, 'report.pdf');
      await fsPromises.writeFile(filePath, pdfBuffer);
      return { success: true, url: `/api/storage/feedback-reports/${safeId}/report.pdf`, path: filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: `Driver ${DRIVER} not implemented for saveFeedbackReport` };
};

// ── Delete Recording ────────────────────────────────────────────────────
const deleteRecording = async (recordingPath) => {
  if (!recordingPath) return { success: true };

  if (DRIVER === 's3') {
    try {
      const { getS3Client, DeleteObjectCommand } = getS3Helpers();
      await getS3Client().send(new DeleteObjectCommand({
        Bucket: S3_BUCKET(),
        Key: recordingPath,
      }));
      console.log(`[Storage] Deleted S3 recording: ${recordingPath}`);
      return { success: true };
    } catch (error) {
      console.error(`[Storage] S3 delete failed: ${recordingPath}`, error.message);
      return { success: false, error: error.message };
    }
  }

  if (DRIVER === 'local') {
    try {
      await fsPromises.unlink(recordingPath);
      console.log(`[Storage] Deleted local recording: ${recordingPath}`);
      return { success: true };
    } catch (error) {
      if (error.code === 'ENOENT') return { success: true };
      console.error(`[Storage] Failed to delete local recording: ${recordingPath}`, error.message);
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: `Driver ${DRIVER} not implemented for deleteRecording` };
};

// ── Get Recording Download URL ──────────────────────────────────────────
const getRecordingDownloadUrl = async (recordingPath, interviewId) => {
  if (DRIVER === 's3') {
    try {
      const { getS3Client, GetObjectCommand, getSignedUrl } = getS3Helpers();
      const url = await getSignedUrl(getS3Client(), new GetObjectCommand({
        Bucket: S3_BUCKET(),
        Key: recordingPath,
        ResponseContentDisposition: `attachment; filename="mockmate-interview-${sanitizeId(interviewId)}.webm"`,
      }), { expiresIn: 3600 }); // 1-hour signed URL
      return { success: true, url };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  if (DRIVER === 'local') {
    return { success: true, url: `/api/storage/recordings/${sanitizeId(interviewId)}/download` };
  }

  return { success: false, error: `Driver ${DRIVER} not implemented for getRecordingDownloadUrl` };
};

/**
 * Get a short-lived signed stream URL for S3 recordings.
 */
const getRecordingStreamUrl = async (recordingPath, interviewId) => {
  if (DRIVER === 's3') {
    try {
      const { getS3Client, GetObjectCommand, getSignedUrl } = getS3Helpers();
      const url = await getSignedUrl(getS3Client(), new GetObjectCommand({
        Bucket: S3_BUCKET(),
        Key: recordingPath,
      }), { expiresIn: 3600 }); // 1-hour signed URL
      return { success: true, url };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  if (DRIVER === 'local') {
    return { success: true, url: `/api/storage/recordings/${sanitizeId(interviewId)}/stream` };
  }

  return { success: false, error: `Driver ${DRIVER} not implemented for getRecordingStreamUrl` };
};

module.exports = {
  uploadResume,
  saveRecording,
  saveFeedbackReport,
  deleteRecording,
  getRecordingDownloadUrl,
  getRecordingStreamUrl,
  BASE_PATH,
  DRIVER,
  sanitizeId,
  sanitizeFilename,
};
