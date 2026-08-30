const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to PostgreSQL (Railway sets DATABASE_URL automatically)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Allow large JSON bodies (for base64 images)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve the frontend
app.use(express.static(path.join(__dirname, 'public')));

// ===================== DATABASE SETUP =====================
async function initDB() {
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

    // Insert sample products if table is empty
    const count = await pool.query('SELECT COUNT(*) FROM products');
    if (parseInt(count.rows[0].count) === 0) {
      const samples = [
        ['Heineken Beer (Carton)', 'Premium imported lager beer. 24 bottles per carton.', 18000, 'beer', 'Per Carton', '50 Cartons', true],
        ['Coca-Cola 50cl (Crate)', 'Classic Coca-Cola PET bottles. 24 pieces per crate.', 4500, 'softdrink', 'Per Crate', '100 Crates', true],
        ['Hennessy VS Cognac', 'Hennessy Very Special Cognac. 70cl bottle.', 28000, 'wine', 'Per Bottle', '12 Bottles', true],
        ['Chi Exotic Juice (Pack)', 'Tropical fruit juice blend. 1L x 12 pack.', 6500, 'juice', 'Per Pack', '50 Packs', true],
        ['Red Bull Energy (Tray)', 'Red Bull 250ml x 24 cans per tray.', 14000, 'energy', 'Per Tray', '30 Trays', true],
        ['Eva Water (Pack)', 'Premium table water. 75cl x 12 per pack.', 2200, 'water', 'Per Pack', '200 Packs', true],
        ['Guinness Foreign Extra (Carton)', 'Bold Nigerian stout. 60cl x 12 bottles.', 8500, 'beer', 'Per Carton', '80 Cartons', false],
        ['Fanta Orange 50cl (Crate)', 'Refreshing orange soft drink. 24 bottles.', 4500, 'softdrink', 'Per Crate', '100 Crates', true],
        ['Jack Daniels Whiskey', 'Tennessee whiskey. 70cl bottle.', 22000, 'wine', 'Per Bottle', '6 Bottles', true],
        ['Star Lager Beer (Crate)', 'Nigerian favourite. 60cl x 12 bottles.', 5800, 'beer', 'Per Crate', '100 Crates', true],
        ['Five Alive Juice (Pack)', 'Citrus burst juice. 1L x 12 per pack.', 7000, 'juice', 'Per Pack', '60 Packs', true],
        ['Hollandia Yoghurt (Carton)', 'Creamy strawberry yoghurt. 500ml x 12.', 7200, 'other', 'Per Carton', '40 Cartons', true]
      ];

      for (const s of samples) {
        await pool.query(
          'INSERT INTO products (name, description, price, category, unit, min_order, available) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          s
        );
      }
      console.log('✅ Sample products inserted');
    }

    console.log('✅ Database initialized');
  } catch (err) {
    console.error('❌ Database error:', err.message);
  }
}

// ===================== API ROUTES =====================

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new product
app.post('/api/products', async (req, res) => {
  try {
    const { name, description, price, category, unit, min_order, available, image } = req.body;
    const result = await pool.query(
      `INSERT INTO products (name, description, price, category, unit, min_order, available, image)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, description || '', price, category || 'other', unit || '', min_order || '', available !== false, image || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update product
app.put('/api/products/:id', async (req, res) => {
  try {
    const { name, description, price, category, unit, min_order, available, image } = req.body;
    const result = await pool.query(
      `UPDATE products SET name=$1, description=$2, price=$3, category=$4,
       unit=$5, min_order=$6, available=$7, image=$8 WHERE id=$9 RETURNING *`,
      [name, description || '', price, category || 'other', unit || '', min_order || '', available !== false, image || '', req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle availability
app.patch('/api/products/:id/toggle', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE products SET available = NOT available WHERE id=$1 RETURNING *',
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== START SERVER =====================
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 3MK Depot running on port ${PORT}`);
  });
});