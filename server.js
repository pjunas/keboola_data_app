import express from 'express';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = '/data/in/tables';

// Serve static frontend from /public
app.use(express.static('public'));

// Required: respond to GET and POST on root for Keboola startup check
app.all('/', (req, res, next) => {
  if (req.method === 'POST') {
    return res.send('OK');
  }
  next();
});

// API endpoint: read a CSV file from input mapping and return as JSON
app.get('/api/data/:tableName', (req, res) => {
  const { tableName } = req.params;
  const filePath = path.join(DATA_DIR, `${tableName}.csv`);
  
  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        error: `Table not found: ${tableName}`,
        path: filePath 
      });
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    res.json({
      table: tableName,
      rowCount: records.length,
      data: records
    });
  } catch (err) {
    res.status(500).json({ 
      error: err.message,
      table: tableName
    });
  }
});

// API endpoint: list available tables
app.get('/api/tables', (req, res) => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      return res.json({ tables: [], note: 'Data directory not found' });
    }
    
    const files = fs.readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.csv'))
      .map(f => f.replace('.csv', ''));
    
    res.json({ tables: files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`E-commerce Data App running on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
