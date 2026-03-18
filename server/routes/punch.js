const express = require('express');
const router  = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const fetch   = require('node-fetch');
const FormData = require('form-data');
const { connectDB, getCluster } = require('../db/couchbase');

const PRIVATE_EC2_URL = `http://${process.env.PRIVATE_EC2_IP}:${process.env.PRIVATE_EC2_PORT}`;

// POST /api/punch
router.post('/punch', async (req, res) => {
  try {
    const collection = await connectDB();
    const {
      time, date, timezone, source,
      label, user, breakDuration, imageBase64
    } = req.body;

    console.log(`\n→ Punch: ${user} | ${label}`);

    // 1. Send to Private EC2 — handles image upload + CSV
    let imageUrl = null;
    try {
      const privateRes = await fetch(`${PRIVATE_EC2_URL}/punch`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          time, date, timezone, source,
          label, user, breakDuration, imageBase64,
        }),
        timeout: 15000,
      });
      const privateData = await privateRes.json();
      if (privateData.success) {
        imageUrl = privateData.imageUrl;
        console.log(`✅ Private EC2 processed | image: ${imageUrl ? 'yes' : 'no'}`);
      }
    } catch (err) {
      console.error('⚠️ Private EC2 call failed:', err.message);
      // Continue saving to Couchbase even if Private EC2 fails
    }

    // 2. Save to Couchbase
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
    console.log(`✅ Couchbase saved: ${user} | ${label}`);

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

// GET /api/report/monthly
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
    if (user && user !== 'All') query += ` AND user = '${user}'`;
    query += ` ORDER BY createdAt ASC`;

    const result  = await cluster.query(query);
    const punches = result.rows;

    if (punches.length === 0) {
      return res.status(404).json({ success: false, error: 'No records found for this month' });
    }

    const esc = (v) => {
      if (!v) return '';
      const s = String(v);
      return s.includes(',') || s.includes('\n') ? `"${s}"` : s;
    };

    let csv = 'PunchId,User,Type,Time,Date,Timezone,Source,BreakDuration,ImageUrl,CreatedAt\n';
    punches.forEach(p => {
      csv += [esc(p.id), esc(p.user), esc(p.label), esc(p.time), esc(p.date), esc(p.timezone), esc(p.source), esc(p.breakDuration), esc(p.imageUrl), esc(p.createdAt)].join(',') + '\n';
    });

    const fileName = `attendance-${month}-${year}${user && user !== 'All' ? '-' + user.replace(' ', '_') : ''}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csv);
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
