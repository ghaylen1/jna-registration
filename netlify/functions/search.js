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

// Get all available student tables
async function getStudentTables(client) {
  const result = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE 'students%'
    ORDER BY table_name
  `);
  return result.rows.map(row => row.table_name);
}

// Search across all student tables
async function searchInAllTables(client, phoneNumber, tables) {
  for (const tableName of tables) {
    try {
      const result = await client.query(
        `SELECT * FROM ${tableName} WHERE phone_number = $1 LIMIT 1`,
        [phoneNumber]
      );
      
      if (result.rows.length > 0) {
        return { found: true, data: result.rows[0], source: tableName };
      }
    } catch (error) {
      console.error(`Error searching in ${tableName}:`, error.message);
    }
  }
  return { found: false };
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
    
    // Get all student tables
    const studentTables = await getStudentTables(client);
    
    if (studentTables.length === 0) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'No student tables found'
        })
      };
    }
    
    // Search in all student tables
    const searchResult = await searchInAllTables(client, phoneNumber, studentTables);
    
    if (searchResult.found) {
      const student = searchResult.data;
      
      console.log(`Found in ${searchResult.source}:`, student.phone_number);
      
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
          source: searchResult.source,
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
    
    // If not in student tables, search in registrations table
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
    
    // Not found in any table
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
