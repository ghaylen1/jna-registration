const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

exports.handler = async (event) => {
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

  let client;
  try {
    client = await pool.connect();
    
    // Search for student
    const studentResult = await client.query(
      'SELECT * FROM students WHERE phone_number = $1 LIMIT 1',
      [phoneNumber]
    );

    if (studentResult.rows.length > 0) {
      const student = studentResult.rows[0];
      
      console.log('Found student:', student);
      
      // Insert into registrations table
      try {
        await client.query(
          `INSERT INTO registrations 
           (full_name, phone_number, university, position, member, participates_in_jna) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            student.full_name,
            student.phone_number,
            student.university,
            student.position || null,
            student.member || null,
            student.participates_in_jna
          ]
        );
        console.log('Registration saved for:', student.phone_number);
      } catch (insertError) {
        // If duplicate, just log it but don't fail
        if (insertError.code === '23505') {
          console.log('User already registered:', student.phone_number);
        } else {
          console.error('Insert error:', insertError);
          throw insertError;
        }
      }
      
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
    console.error('Error details:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Database error',
        message: error.message
      })
    };
  } finally {
    if (client) {
      client.release();
    }
  }
};
