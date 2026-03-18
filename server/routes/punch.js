const express = require('express');
const router  = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const AWS     = require('aws-sdk');
const { connectDB, getCluster } = require('../db/couchbase');

const s3 = new AWS.S3({
  accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region:          process.env.AWS_REGION || 'ap-south-1',
});

const S3_BUCKET = process.env.AWS_S3_BUCKET || 'punchin-screenshots-bucket';

// Build date folder: 2026/March/17
function getDateFolder() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.toLocaleString('en-US', { month: 'long' });
  const day   = String(now.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

// CSV header row
const CSV_HEADER = 'PunchId,User,Type,Time,Date,Timezone,Source,BreakDuration,ImageUrl,CreatedAt\n';

// Convert one punch doc to a CSV row
function docToCsvRow(doc, docId) {
  const escape = (val) => {
    if (!val) return '';
    const str = String(val);
    // wrap in quotes if contains comma or newline
    return str.includes(',') || str.includes('\n') ? `"${str}"` : str;
  };
  return [
    escape(docId),
    escape(doc.user),
    escape(doc.label),
    escape(doc.time),
    escape(doc.date),
    escape(doc.timezone),
    escape(doc.source),
    escape(doc.breakDuration),
    escape(doc.imageUrl),
    escape(doc.createdAt),
  ].join(',') + '\n';
}

// Upload selfie image to S3
async function uploadImageToS3(imageBase64) {
  try {
    const base64Data  = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const folder      = getDateFolder();
    const fileName    = `${folder}/punch-${uuidv4()}.jpg`;

    const result = await s3.upload({
      Bucket:      S3_BUCKET,
      Key:         fileName,
      Body:        imageBuffer,
      ContentType: 'image/jpeg',
    }).promise();

    console.log('✅ Image uploaded to S3:', result.Location);
    return result.Location;
  } catch (err) {
    console.error('❌ Image upload error:', err.message);
    return null;
  }
}

// Append new row to today's CSV file in S3
async function appendToCsv(doc, docId) {
  try {
    const folder  = getDateFolder();
    const csvKey  = `reports/${folder}/attendance.csv`;
    const newRow  = docToCsvRow(doc, docId);

    // Try to get existing CSV
    let existingContent = '';
    try {
      const existing = await s3.getObject({
        Bucket: S3_BUCKET,
        Key:    csvKey,
      }).promise();
      existingContent = existing.Body.toString('utf-8');
      console.log(`📄 Found existing CSV: ${csvKey}`);
    } catch (err) {
      // File doesn't exist yet — start fresh with header
      existingContent = CSV_HEADER;
      console.log(`📄 Creating new CSV: ${csvKey}`);
    }

    // Append new row
    const updatedContent = existingContent + newRow;

    // Save back to S3
    await s3.putObject({
      Bucket:      S3_BUCKET,
      Key:         csvKey,
      Body:        updatedContent,
      ContentType: 'text/csv',
    }).promise();

    console.log(`✅ CSV updated: reports/${folder}/attendance.csv`);
    return true;
  } catch (err) {
    console.error('❌ CSV update error:', err.message);
    return false;
  }
}

// ── POST /api/punch
router.post('/punch', async (req, res) => {
  try {
    const collection = await connectDB();
    const {
      time, date, timezone, source,
      label, user, breakDuration, imageBase64
    } = req.body;

    // 1. Upload selfie image to S3
    let imageUrl = null;
    if (imageBase64) {
      imageUrl = await uploadImageToS3(imageBase64);
    }

    // 2. Build document
    const id  = `punch::${uuidv4()}`;
    const doc = {
      type:          'punch',
      time:          time          || '',
      date:          date          || '',
      timezone:      timezone      || '',
      source:        source        || 'auto',
      label:         label         || 'Punch In',
      user:          user          || 'Unknown',
      breakDuration: breakDuration || null,
      imageUrl:      imageUrl,
      createdAt:     new Date().toISOString(),
    };

    // 3. Save to Couchbase
    await collection.insert(id, doc);
    console.log(`✅ Couchbase saved: ${user} | ${label}`);

    // 4. Append to today's CSV in S3
    const cleanId = id.replace('punch::', 'punch-');
    await appendToCsv(doc, cleanId);

    res.status(201).json({ success: true, id, doc });
  } catch (err) {
    console.error('Error saving punch:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/punches
router.get('/punches', async (req, res) => {
  try {
    const cluster    = await getCluster();
    const bucketName = process.env.COUCHBASE_BUCKET;

    const query = `
      SELECT META().id, time, date, timezone, source,
             label, user, breakDuration, imageUrl, createdAt
      FROM \`${bucketName}\`._default._default
      WHERE type = 'punch'
      ORDER BY createdAt DESC
    `;

    const result  = await cluster.query(query);
    const punches = result.rows;

    // Calculate shift duration per Punch Out row
    const processed = punches.map(punch => {
      if (punch.label !== 'Punch Out') return { ...punch, shiftDuration: null };

      const matchingIn = punches
        .filter(p =>
          p.label === 'Punch In' &&
          p.user  === punch.user &&
          p.date  === punch.date &&
          new Date(p.createdAt) < new Date(punch.createdAt)
        )
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

      if (!matchingIn) return { ...punch, shiftDuration: null };

      const diffMs   = new Date(punch.createdAt) - new Date(matchingIn.createdAt);
      const totalSec = Math.floor(diffMs / 1000);
      const hrs      = Math.floor(totalSec / 3600);
      const mins     = Math.floor((totalSec % 3600) / 60);
      const secs     = totalSec % 60;

      let shiftDuration = '';
      if (hrs > 0)       shiftDuration = `${hrs}h ${mins}m`;
      else if (mins > 0) shiftDuration = `${mins}m ${secs}s`;
      else               shiftDuration = `${secs}s`;

      return { ...punch, shiftDuration };
    });

    res.json({ success: true, punches: processed });
  } catch (err) {
    console.error('Error fetching punches:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/punch/:id
router.delete('/punch/:id', async (req, res) => {
  try {
    const collection = await connectDB();
    const id = decodeURIComponent(req.params.id);
    await collection.remove(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting punch:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
