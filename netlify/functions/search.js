const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Create registrations table if it doesn't exist
async function createRegistrationsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS registrations (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(100),
        phone_number VARCHAR(20) NOT NULL UNIQUE,
        university VARCHAR(100),
        position VARCHAR(100),
        member VARCHAR(200),
        participates_in_jna VARCHAR(10),
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_registration_phone ON registrations(phone_number);
      CREATE INDEX IF NOT EXISTS idx_registration_date ON registrations(registered_at);
    `);
  } catch (error) {
    console.error('Error creating registrations table:', error);
  }
}

// Save registration data
async function saveRegistration(student) {
  try {
    await pool.query(
      `INSERT INTO registrations 
       (full_name, phone_number, university, position, member, participates_in_jna) 
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (phone_number) DO UPDATE SET
       registered_at = CURRENT_TIMESTAMP`,
      [
        student.full_name,
        student.phone_number,
        student.university,
        student.position || null,
        student.member || null,
        student.participates_in_jna
      ]
    );
    console.log('Registration saved:', student.phone_number);
  } catch (error) {
    console.error('Error saving registration:', error);
  }
}

exports.handler = async (event) => {
  // Create registrations table on first request
  await createRegistrationsTable();

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const phoneNumber = event.queryStringParameters?.phone;

  if (!phoneNumber) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Phone number is required' })
    };
  }

  try {
    const result = await pool.query(
      'SELECT * FROM students WHERE phone_number = $1 LIMIT 1',
      [phoneNumber]
    );

    if (result.rows.length > 0) {
      const student = result.rows[0];
      
      // Save the registration data
      await saveRegistration(student);
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          data: {
            full_name: student.full_name,
            university: student.university,
            position: student.position || 'N/A',
            member: student.member || 'N/A',
            participates_in_jna: student.participates_in_jna
          }
        })
      };
    } else {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Student not found'
        })
      };
    }
  } catch (error) {
    console.error('Database error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Database error',
        message: error.message
      })
    };
  }
};
