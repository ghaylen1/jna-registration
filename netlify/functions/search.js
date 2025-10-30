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
    
    // Search for student with validated phone number
    const result = await client.query(
      'SELECT * FROM students WHERE phone_number = $1 LIMIT 1',
      [phoneNumber]
    );

    if (result.rows.length > 0) {
      const student = result.rows[0];
      
      console.log('Found student:', student.phone_number);
      
      // Save the registration data
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
        console.log('Registration saved:', student.phone_number);
      } catch (insertError) {
        console.error('Insert error:', insertError.message);
        console.error('Error code:', insertError.code);
        // Continue even if registration save fails
      }
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          data: {
            full_name: student.full_name || '',
            university: student.university || '',
            position: student.position || 'N/A',
            member: student.member || 'N/A',
            participates_in_jna: student.participates_in_jna || 'N/A'
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
    console.error('Database error:', error.message);
    console.error('Error code:', error.code);
    console.error('Query:', error.query);
    
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
