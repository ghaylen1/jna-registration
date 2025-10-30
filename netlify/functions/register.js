const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Validate phone number format (216 + 8 digits)
function isValidPhoneNumber(phone) {
  const cleaned = phone.replace(/\D/g, '');
  const phoneRegex = /^216\d{8}$/;
  return phoneRegex.test(cleaned);
}

// Validate string length
function validateStringLength(str, min, max, fieldName) {
  if (!str || str.length < min || str.length > max) {
    return `${fieldName} must be between ${min} and ${max} characters`;
  }
  return null;
}

// Sanitize string input
function sanitizeInput(str) {
  if (!str) return '';
  return str.toString().trim();
}

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Parse JSON body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (error) {
    console.error('JSON parse error:', error);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false,
        message: 'Invalid JSON format' 
      })
    };
  }

  // Extract and sanitize fields
  const full_name = sanitizeInput(body.full_name);
  const phone_number = sanitizeInput(body.phone_number);
  const university = sanitizeInput(body.university);
  const position = sanitizeInput(body.position || '');
  const member = sanitizeInput(body.member || '');
  const participates_in_jna = 'OUI'; // Default value

  // Validate required fields
  if (!full_name || !phone_number || !university) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false,
        message: 'Les champs requis sont manquants (nom, téléphone, établissement)' 
      })
    };
  }

  // Validate field lengths
  const nameError = validateStringLength(full_name, 2, 100, 'Nom');
  if (nameError) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false,
        message: 'Nom invalide (2-100 caractères)' 
      })
    };
  }

  const universityError = validateStringLength(university, 2, 100, 'Établissement');
  if (universityError) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false,
        message: 'Établissement invalide (2-100 caractères)' 
      })
    };
  }

  if (position && position.length > 100) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false,
        message: 'Position invalide (maximum 100 caractères)' 
      })
    };
  }

  if (member && member.length > 200) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false,
        message: 'Département invalide (maximum 200 caractères)' 
      })
    };
  }

  // Validate phone number format
  if (!isValidPhoneNumber(phone_number)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false,
        message: 'Numéro de téléphone invalide' 
      })
    };
  }

  let client;
  try {
    client = await pool.connect();
    
    // Insert new registration
    await client.query(
      `INSERT INTO registrations 
       (full_name, phone_number, university, position, member, participates_in_jna) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        full_name,
        phone_number,
        university,
        position || null,
        member || null,
        participates_in_jna
      ]
    );

    console.log('New registration saved:', phone_number);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Inscription réussie!',
        data: {
          full_name,
          phone_number,
          university,
          position,
          member,
          participates_in_jna
        }
      })
    };

  } catch (error) {
    console.error('Database error:', error.message);
    console.error('Error code:', error.code);

    // Handle duplicate phone number
    if (error.code === '23505') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Ce numéro de téléphone est déjà enregistré.'
        })
      };
    }

    // Handle other database errors
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        message: 'Une erreur interne s\'est produite'
      })
    };

  } finally {
    if (client) {
      client.release();
    }
  }
};
