const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
const FormData = require('form-data');
const { connectDB, getCluster } = require('../db/couchbase');

const PRIVATE_EC2_URL = `http://${process.env.PRIVATE_EC2_IP}:${process.env.PRIVATE_EC2_PORT}`;

// POST /api/punch - Save punch with optional image
router.post('/punch', async (req, res) => {
  try {
    const collection = await connectDB();
    const { time, date, timezone, source, label, user, breakDuration, imageBase64 } = req.body;

    let imageUrl = null;

    // If image provided, upload to S3 via Private EC2
    if (imageBase64) {
      try {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        const formData = new FormData();
        formData.append('image', imageBuffer, {
          filename: 'punch.jpg',
          contentType: 'image/jpeg',
        });

        const uploadRes = await fetch(`${PRIVATE_EC2_URL}/upload`, {
          method: 'POST',
          body: formData,
          headers: formData.getHeaders(),
        });

        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          imageUrl = uploadData.url;
          console.log('Image uploaded to S3:', imageUrl);
        }
      } catch (imgErr) {
        console.error('Image upload failed:', imgErr.message);
      }
    }

    const id = `punch::${uuidv4()}`;
    const doc = {
      type: 'punch',
      time: time || '',
      date: date || '',
      timezone: timezone || '',
      source: source || 'auto',
      label: label || 'Punch In',
      user: user || 'Unknown',
      breakDuration: breakDuration || null,
      imageUrl: imageUrl,
      createdAt: new Date().toISOString(),
    };

    await collection.insert(id, doc);
    console.log('Saved punch for:', user, '| Image:', imageUrl ? 'yes' : 'no');
    res.status(201).json({ success: true, id, doc });
  } catch (err) {
    console.error('Error saving punch:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/punches
router.get('/punches', async (req, res) => {
  try {
    const cluster = await getCluster();
    const bucketName = process.env.COUCHBASE_BUCKET;

    const query = `
      SELECT META().id, time, date, timezone, source, label, user, breakDuration, imageUrl, createdAt
      FROM \`${bucketName}\`._default._default
      WHERE type = 'punch'
      ORDER BY createdAt DESC
    `;

    const result = await cluster.query(query);
    res.json({ success: true, punches: result.rows });
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
