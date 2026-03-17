const express = require('express');
const router  = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const AWS     = require('aws-sdk');
const { connectDB, getCluster } = require('../db/couchbase');

// S3 configured directly on Render
const s3 = new AWS.S3({
  accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region:          process.env.AWS_REGION || 'ap-south-1',
});

const S3_BUCKET = process.env.AWS_S3_BUCKET || 'punchin-screenshots-bucket';

// S3 folder: 2026/March/17
function getS3FolderPath() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.toLocaleString('en-US', { month: 'long' });
  const day   = String(now.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

// Upload base64 image to S3
async function uploadImageToS3(imageBase64) {
  try {
    const base64Data  = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const folder      = getS3FolderPath();
    const fileName    = `${folder}/punch-${uuidv4()}.jpg`;

    console.log(`Uploading to S3: ${fileName}`);

    const result = await s3.upload({
      Bucket:      S3_BUCKET,
      Key:         fileName,
      Body:        imageBuffer,
      ContentType: 'image/jpeg',
    }).promise();

    console.log('✅ S3 upload success:', result.Location);
    return result.Location;
  } catch (err) {
    console.error('❌ S3 upload error:', err.message);
    return null;
  }
}

// POST /api/punch
router.post('/punch', async (req, res) => {
  try {
    const collection = await connectDB();
    const {
      time, date, timezone, source,
      label, user, breakDuration, imageBase64
    } = req.body;

    // Upload image to S3 if provided
    let imageUrl = null;
    if (imageBase64) {
      imageUrl = await uploadImageToS3(imageBase64);
    }

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

    await collection.insert(id, doc);
    console.log(`Saved punch for: ${user} | Image: ${imageUrl ? 'yes ✅' : 'no'}`);
    res.status(201).json({ success: true, id, doc });

  } catch (err) {
    console.error('Error saving punch:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/punches
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

    const result = await cluster.query(query);
    const punches = result.rows;

    // Calculate shift duration: Punch In → Punch Out per user per day
    const processed = punches.map(punch => {
      if (punch.label === 'Punch Out') {
        const matchingPunchIn = punches.find(p =>
          p.label  === 'Punch In' &&
          p.user   === punch.user &&
          p.date   === punch.date &&
          new Date(p.createdAt) < new Date(punch.createdAt)
        );
        if (matchingPunchIn) {
          const diffMs   = new Date(punch.createdAt) - new Date(matchingPunchIn.createdAt);
          const totalSec = Math.floor(diffMs / 1000);
          const hrs      = Math.floor(totalSec / 3600);
          const mins     = Math.floor((totalSec % 3600) / 60);
          const secs     = totalSec % 60;
          let shiftDuration = '';
          if (hrs > 0)       shiftDuration = `${hrs}h ${mins}m`;
          else if (mins > 0) shiftDuration = `${mins}m ${secs}s`;
          else               shiftDuration = `${secs}s`;
          return { ...punch, shiftDuration };
        }
      }
      return { ...punch, shiftDuration: null };
    });

    res.json({ success: true, punches: processed });
  } catch (err) {
    console.error('Error fetching punches:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/punch/:id
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
