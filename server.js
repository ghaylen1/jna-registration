require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Neon
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Search endpoint
app.get('/api/search', async (req, res) => {
  const phoneNumber = req.query.phone;

  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM students WHERE phone_number = $1 LIMIT 1',
      [phoneNumber]
    );

    if (result.rows.length > 0) {
      const student = result.rows[0];
      return res.json({
        success: true,
        data: {
          full_name: student.full_name,
          university: student.university,
          position: student.position || 'N/A',
          member: student.member || 'N/A',
          participates_in_jna: student.participates_in_jna
        }
      });
    } else {
      return res.json({
        success: false,
        message: 'Student not found'
      });
    }
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ 
      error: 'Database error',
      message: error.message 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});