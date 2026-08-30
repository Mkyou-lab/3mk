const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Railway Postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Allow large JSON (images)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Create table
async function initDB() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is missing! Add a PostgreSQL plugin on Railway and link it.');
    return;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(300) NOT NULL,
        description TEXT DEFAULT '',
        price DECIMAL(12,2) NOT NULL DEFAULT 0,
        category VARCHAR(50) DEFAULT 'other',
        unit VARCHAR(100) DEFAULT '',
        min_order VARCHAR(100) DEFAULT '',
        available BOOLEAN DEFAULT true,
        image TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const count = await pool.query('SELECT COUNT(*) FROM products');
    if (parseInt(count.rows[0].count, 10) === 0) {
      const samples = [
        ['Heineken Beer (Carton)', 'Premium lager. 24 bottles.', 18000, 'beer', 'Per Carton', true],
        ['Coca-Cola 50cl (Crate)', '24 PET bottles per crate.', 4500, 'softdrink', 'Per Crate', true],
        ['Hennessy VS Cognac', '70cl original sealed.', 28000, 'wine', 'Per Bottle', true],
        ['Chi Exotic Juice (Pack)', '1L x 12 pack.', 6500, 'juice', 'Per Pack', true],
        ['Eva Water (Pack)', '75cl x 12 bottles.', 2200, 'water', 'Per Pack', true],
        ['Star Lager (Crate)', '60cl x 12 bottles.', 5800, 'beer', 'Per Crate', true]
      ];
      for (const s of samples) {
        await pool.query(
          `INSERT INTO products (name, description, price, category, unit, available)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          s
        );
      }
      console.log('✅ Sample products inserted');
    }

    console.log('✅ Database ready');
  } catch (err) {
    console.error('❌ DB init error:', err.message);
  }
}

// GET all
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// CREATE
app.post('/api/products', async (req, res) => {
  try {
    const {
      name,
      description = '',
      price,
      category = 'other',
      unit = '',
      min_order = '',
      available = true,
      image = ''
    } = req.body;

    if (!name || price === undefined || price === null || price === '') {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    // Block accidental non-image strings
    let img = '';
    if (typeof image === 'string' && image.startsWith('data:image')) {
      // Optional safety: reject very huge images (~> 8MB base64)
      if (image.length > 8_000_000) {
        return res.status(400).json({
          error: 'Image too large. Use a smaller photo (under ~2MB).'
        });
      }
      img = image;
    }

    const result = await pool.query(
      `INSERT INTO products
        (name, description, price, category, unit, min_order, available, image)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        String(name).trim(),
        String(description || ''),
        Number(price),
        category || 'other',
        unit || '',
        min_order || '',
        available === true || available === 'true',
        img
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/products error:', err);
    res.status(500).json({ error: err.message || 'Server save failed' });
  }
});

// UPDATE
app.put('/api/products/:id', async (req, res) => {
  try {
    const {
      name,
      description = '',
      price,
      category = 'other',
      unit = '',
      min_order = '',
      available = true,
      image = ''
    } = req.body;

    if (!name || price === undefined || price === null || price === '') {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    let img = '';
    if (typeof image === 'string' && image.startsWith('data:image')) {
      if (image.length > 8_000_000) {
        return res.status(400).json({
          error: 'Image too large. Use a smaller photo (under ~2MB).'
        });
      }
      img = image;
    }

    const result = await pool.query(
      `UPDATE products SET
        name=$1, description=$2, price=$3, category=$4,
        unit=$5, min_order=$6, available=$7, image=$8
       WHERE id=$9
       RETURNING *`,
      [
        String(name).trim(),
        String(description || ''),
        Number(price),
        category || 'other',
        unit || '',
        min_order || '',
        available === true || available === 'true',
        img,
        req.params.id
      ]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /api/products error:', err);
    res.status(500).json({ error: err.message || 'Server update failed' });
  }
});

// TOGGLE stock
app.patch('/api/products/:id/toggle', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE products SET available = NOT available
       WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE
app.delete('/api/products/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      ok: true,
      database: !!process.env.DATABASE_URL
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
      database: !!process.env.DATABASE_URL
    });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 3MK Depot on port ${PORT}`));
});
