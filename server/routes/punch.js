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

function getDateFolder() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.toLocaleString('en-US', { month: 'long' });
  const day   = String(now.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

const CSV_HEADER = 'PunchId,User,Type,Time,Date,Timezone,Source,BreakDuration,ImageUrl,CreatedAt\n';

function docToCsvRow(doc, docId) {
  const escape = (val) => {
    if (!val) return '';
    const str = String(val);
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

async function uploadImageToS3(imageBase64) {
  try {
    const base64Data  = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const folder      = getDateFolder();
    const fileName    = `${folder}/punch-${uuidv4()}.jpg`;
    const result = await s3.upload({
      Bucket: S3_BUCKET, Key: fileName,
      Body: imageBuffer, ContentType: 'image/jpeg',
    }).promise();
    console.log('✅ Image uploaded:', result.Location);
    return result.Location;
  } catch (err) {
    console.error('❌ Image upload error:', err.message);
    return null;
  }
}

async function appendToCsv(doc, docId) {
  try {
    const folder  = getDateFolder();
    const csvKey  = `reports/${folder}/attendance.csv`;
    const newRow  = docToCsvRow(doc, docId);
    let existingContent = '';
    try {
      const existing = await s3.getObject({ Bucket: S3_BUCKET, Key: csvKey }).promise();
      existingContent = existing.Body.toString('utf-8');
    } catch {
      existingContent = CSV_HEADER;
    }
    await s3.putObject({
      Bucket: S3_BUCKET, Key: csvKey,
      Body: existingContent + newRow, ContentType: 'text/csv',
    }).promise();
    console.log(`✅ CSV updated: ${csvKey}`);
  } catch (err) {
    console.error('❌ CSV update error:', err.message);
  }
}

// POST /api/punch
router.post('/punch', async (req, res) => {
  try {
    const collection = await connectDB();
    const { time, date, timezone, source, label, user, breakDuration, imageBase64 } = req.body;

    let imageUrl = null;
    if (imageBase64) imageUrl = await uploadImageToS3(imageBase64);

    const id  = `punch::${uuidv4()}`;
    const doc = {
      type: 'punch', time: time || '', date: date || '',
      timezone: timezone || '', source: source || 'auto',
      label: label || 'Punch In', user: user || 'Unknown',
      breakDuration: breakDuration || null,
      imageUrl: imageUrl, createdAt: new Date().toISOString(),
    };

    await collection.insert(id, doc);
    console.log(`✅ Couchbase: ${user} | ${label}`);
    await appendToCsv(doc, id.replace('punch::', 'punch-'));

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
    const result  = await cluster.query(query);
    const punches = result.rows;

    const processed = punches.map(punch => {
      if (punch.label !== 'Punch Out') return { ...punch, shiftDuration: null };
      const matchingIn = punches
        .filter(p =>
          p.label === 'Punch In' && p.user === punch.user &&
          p.date  === punch.date && new Date(p.createdAt) < new Date(punch.createdAt)
        )
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      if (!matchingIn) return { ...punch, shiftDuration: null };
      const diffMs   = new Date(punch.createdAt) - new Date(matchingIn.createdAt);
      const totalSec = Math.floor(diffMs / 1000);
      const hrs  = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
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

// GET /api/report/monthly?month=March&year=2026&user=All
router.get('/report/monthly', async (req, res) => {
  try {
    const cluster    = await getCluster();
    const bucketName = process.env.COUCHBASE_BUCKET;
    const { month, year, user } = req.query;

    let query = `
      SELECT META().id, time, date, timezone, source,
             label, user, breakDuration, imageUrl, createdAt
      FROM \`${bucketName}\`._default._default
      WHERE type = 'punch'
      AND date LIKE '%${month}%'
      AND date LIKE '%${year}%'
    `;
    if (user && user !== 'All') {
      query += ` AND user = '${user}'`;
    }
    query += ` ORDER BY createdAt ASC`;

    const result  = await cluster.query(query);
    const punches = result.rows;

    if (punches.length === 0) {
      return res.status(404).json({ success: false, error: 'No records found for this month' });
    }

    // Build CSV content
    let csv = CSV_HEADER;
    punches.forEach(punch => {
      csv += docToCsvRow(punch, punch.id || '');
    });

    // Send CSV as download
    const fileName = `attendance-${month}-${year}${user && user !== 'All' ? '-' + user.replace(' ', '_') : ''}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csv);

    console.log(`✅ Monthly report downloaded: ${fileName} (${punches.length} records)`);
  } catch (err) {
    console.error('Error generating report:', err.message);
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
