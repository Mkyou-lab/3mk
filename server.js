const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'products.json');

// Enable 50MB payload limit so large photos don't crash
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Helper functions to read/write JSON file
function readProducts() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      // Default sample product if empty
      const initialData = [
        {
          id: 1,
          name: "Heineken Beer (Carton)",
          description: "Premium imported lager beer. 24 bottles per carton.",
          price: 18000,
          category: "beer",
          unit: "Per Carton",
          available: true,
          image: ""
        }
      ];
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
      return initialData;
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error("Error reading file database:", err);
    return [];
  }
}

function writeProducts(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing to file database:", err);
  }
}

// 1. GET ALL PRODUCTS
app.get('/api/products', (req, res) => {
  const products = readProducts();
  res.json(products);
});

// 2. ADD PRODUCT
app.post('/api/products', (req, res) => {
  try {
    const { name, description, price, category, unit, available, image } = req.body;
    if (!name || !price) {
      return res.status(400).json({ error: 'Name and Price are required' });
    }

    const products = readProducts();
    const newProduct = {
      id: Date.now(), // Unique ID
      name: String(name).trim(),
      description: String(description || '').trim(),
      price: Number(price),
      category: category || 'other',
      unit: unit || 'Per Unit',
      available: available !== false,
      image: image || ''
    };

    products.unshift(newProduct); // Add to beginning of list
    writeProducts(products);

    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save product' });
  }
});

// 3. EDIT/UPDATE PRODUCT
app.put('/api/products/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, description, price, category, unit, available, image } = req.body;
    let products = readProducts();

    const index = products.findIndex(p => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    products[index] = {
      ...products[index],
      name: String(name).trim(),
      description: String(description || '').trim(),
      price: Number(price),
      category: category || 'other',
      unit: unit || 'Per Unit',
      available: available !== false,
      image: image || products[index].image
    };

    writeProducts(products);
    res.json(products[index]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// 4. TOGGLE IN-STOCK / OUT-OF-STOCK
app.patch('/api/products/:id/toggle', (req, res) => {
  try {
    const id = Number(req.params.id);
    let products = readProducts();
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
      products[index].available = !products[index].available;
      writeProducts(products);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle availability' });
  }
});

// 5. DELETE PRODUCT
app.delete('/api/products/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    let products = readProducts();
    products = products.filter(p => p.id !== id);
    writeProducts(products);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// SPA Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 3MK Depot Auto-Server running on port ${PORT}`);
});
