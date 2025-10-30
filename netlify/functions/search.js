const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Validate phone number format
function isValidPhoneNumber(phone) {
  const cleaned = phone.replace(/\D/g, '');
  const phoneRegex = /^216\d{8}$/;
  return phoneRegex.test(cleaned);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const phoneNumber = event.queryStringParameters?.phone;

  if (!phoneNumber) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Phone number is required' })
    };
  }

  // Validate phone number format
  if (!isValidPhoneNumber(phoneNumber)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false,
        message: 'Format de téléphone invalide' 
      })
    };
  }

  let client;
  try {
    client = await pool.connect();
    
    // Search in students table first
    const studentResult = await client.query(
      'SELECT * FROM students WHERE phone_number = $1 LIMIT 1',
      [phoneNumber]
    );

    if (studentResult.rows.length > 0) {
      const student = studentResult.rows[0];
      
      console.log('Found in students table:', student.phone_number);
      
      // Also save to registrations if not already there
      try {
        await client.query(
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
        console.log('Registration saved/updated:', student.phone_number);
      } catch (insertError) {
        console.error('Insert error:', insertError.message);
      }
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          source: 'students',
          data: {
            full_name: student.full_name || '',
            university: student.university || '',
            position: student.position || 'N/A',
            member: student.member || 'N/A',
            participates_in_jna: student.participates_in_jna || 'N/A'
          }
        })
      };
    }
    
    // If not in students table, search in registrations table
    const registrationResult = await client.query(
      'SELECT * FROM registrations WHERE phone_number = $1 LIMIT 1',
      [phoneNumber]
    );

    if (registrationResult.rows.length > 0) {
      const registration = registrationResult.rows[0];
      
      console.log('Found in registrations table:', registration.phone_number);
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          source: 'registrations',
          data: {
            full_name: registration.full_name || '',
            university: registration.university || '',
            position: registration.position || 'N/A',
            member: registration.member || 'N/A',
            participates_in_jna: registration.participates_in_jna || 'OUI'
          }
        })
      };
    }
    
    // Not found in either table
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        message: 'Student not found in any database'
      })
    };
    
  } catch (error) {
    console.error('Database error:', error.message);
    console.error('Error code:', error.code);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Database error',
        message: 'Une erreur interne s\'est produite'
      })
    };
  } finally {
    if (client) {
      client.release();
    }
  }
};
