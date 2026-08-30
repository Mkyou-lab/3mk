const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to Railway PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// INCREASED LIMIT TO 50MB SO MULTIPLE PICTURES DON'T CRASH IT
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve the frontend
app.use(express.static(path.join(__dirname, 'public')));

// Create the products table safely
async function initDB() {
  if (!process.env.DATABASE_URL) {
    console.log('⚠️ Warning: DATABASE_URL is missing. Please attach PostgreSQL in Railway.');
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
        available BOOLEAN DEFAULT true,
        image TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Database Table Ready');
  } catch (err) {
    console.error('❌ Database error:', err.message);
  }
}

// 1. GET ALL PRODUCTS (Public)
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. ADD NEW PRODUCT (Admin)
app.post('/api/products', async (req, res) => {
  try {
    const { name, description, price, category, unit, available, image } = req.body;
    
    if (!name || !price) return res.status(400).json({ error: 'Name and Price required' });

    const result = await pool.query(
      `INSERT INTO products (name, description, price, category, unit, available, image)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, description || '', price, category || 'other', unit || '', available, image || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save product' });
  }
});

// 3. EDIT/UPDATE PRODUCT (Admin - "Put another one re-edit")
app.put('/api/products/:id', async (req, res) => {
  try {
    const { name, description, price, category, unit, available, image } = req.body;
    const result = await pool.query(
      `UPDATE products SET name=$1, description=$2, price=$3, category=$4, unit=$5, available=$6, image=$7 WHERE id=$8 RETURNING *`,
      [name, description, price, category, unit, available, image, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// 4. TOGGLE AVAILABILITY (Admin)
app.patch('/api/products/:id/toggle', async (req, res) => {
  try {
    await pool.query('UPDATE products SET available = NOT available WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. DELETE PRODUCT (Admin - "Remove the one that is there before")
app.delete('/api/products/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
initDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 3MK Depot running on port ${PORT}`));
});
