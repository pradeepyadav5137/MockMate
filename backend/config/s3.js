/**
 * S3 client configuration for production recording storage.
 * Only initializes when STORAGE_DRIVER=s3.
 */
let s3Client = null;

function getS3Client() {
  if (s3Client) return s3Client;

  const { S3Client } = require('@aws-sdk/client-s3');
  const region = process.env.S3_REGION || process.env.AWS_REGION || 'ap-south-1';

  s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  console.log(`⚡ S3 Client initialized for region ${region}`);
  return s3Client;
}

module.exports = { getS3Client };
