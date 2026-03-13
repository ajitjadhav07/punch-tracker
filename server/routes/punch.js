const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { connectDB, getCluster } = require('../db/couchbase');

// POST /api/punch - Save a new punch-in
router.post('/punch', async (req, res) => {
  try {
    const collection = await connectDB();
    const { time, date, timezone, source, label, user, breakDuration } = req.body;

    const id = `punch::${uuidv4()}`;
    const doc = {
      type: 'punch',
      time,
      date,
      timezone,
      source,
      label: label || 'Punch In',
      user: user || 'Unknown',
      breakDuration: breakDuration || null,
      createdAt: new Date().toISOString(),
};

    await collection.insert(id, doc);
    res.status(201).json({ success: true, id, doc });
  } catch (err) {
    console.error('Error saving punch:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/punches - Get all punch-in records
router.get('/punches', async (req, res) => {
  try {
    const cluster = await getCluster();
    const bucketName = process.env.COUCHBASE_BUCKET;

    const query = `
      SELECT META().id, time, date, timezone, source, label, createdAt
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

// DELETE /api/punch/:id - Delete a punch record
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
