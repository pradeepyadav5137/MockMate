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

const uploadResume = async (fileBuffer, filename, userId) => {
  if (DRIVER === 'local') {
    try {
      const userDir = path.join(BASE_PATH, 'resumes', String(userId));
      await fsPromises.mkdir(userDir, { recursive: true });
      const filePath = path.join(userDir, filename);
      await fsPromises.writeFile(filePath, fileBuffer);
      return { success: true, url: `/api/storage/resumes/${userId}/${filename}`, path: filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  // TODO: Add S3/Cloudinary logic here.
  return { success: false, error: `Driver ${DRIVER} not implemented for uploadResume` };
};

const saveRecording = async (fileBuffer, filename, interviewId) => {
  if (DRIVER === 'local') {
    try {
      const interviewDir = path.join(BASE_PATH, 'recordings', String(interviewId));
      await fsPromises.mkdir(interviewDir, { recursive: true });
      const filePath = path.join(interviewDir, filename);
      await fsPromises.writeFile(filePath, fileBuffer);
      return { success: true, url: `/api/storage/recordings/${interviewId}/${filename}`, path: filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  // TODO: Add S3/Cloudinary logic here.
  return { success: false, error: `Driver ${DRIVER} not implemented for saveRecording` };
};

const saveFeedbackReport = async (pdfBuffer, interviewId) => {
  if (DRIVER === 'local') {
    try {
      const interviewDir = path.join(BASE_PATH, 'feedback-reports', String(interviewId));
      await fsPromises.mkdir(interviewDir, { recursive: true });
      const filePath = path.join(interviewDir, 'report.pdf');
      await fsPromises.writeFile(filePath, pdfBuffer);
      return { success: true, url: `/api/storage/feedback-reports/${interviewId}/report.pdf`, path: filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  // TODO: Add S3/Cloudinary logic here.
  return { success: false, error: `Driver ${DRIVER} not implemented for saveFeedbackReport` };
};

const deleteRecording = async (recordingPath) => {
  if (DRIVER === 'local') {
    try {
      await fsPromises.unlink(recordingPath);
      console.log(`Deleted local recording: ${recordingPath}`);
      return { success: true };
    } catch (error) {
      if (error.code === 'ENOENT') return { success: true };
      console.error(`Failed to delete local recording: ${recordingPath}`, error.message);
      return { success: false, error: error.message };
    }
  }
  // TODO: Add S3/Cloudinary logic here.
  return { success: false, error: `Driver ${DRIVER} not implemented for deleteRecording` };
};

const getRecordingDownloadUrl = async (recordingPath, interviewId) => {
  if (DRIVER === 'local') return { success: true, url: `/api/storage/recordings/${interviewId}/download` };
  // TODO: Add S3 logic to return signed URL here.
  return { success: false, error: `Driver ${DRIVER} not implemented for getRecordingDownloadUrl` };
};

module.exports = { uploadResume, saveRecording, saveFeedbackReport, deleteRecording, getRecordingDownloadUrl, BASE_PATH };
