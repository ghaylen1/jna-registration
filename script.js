// Format and validate phone number
function formatPhoneNumber(phone) {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');
    
    // If it has 8 digits (Tunisian local), add 216
    if (cleaned.length === 8) {
        return '216' + cleaned;
    }
    // If it already has 216 and exactly 11 digits total
    if (cleaned.startsWith('216') && cleaned.length === 11) {
        return cleaned;
    }
    // Invalid format
    return null;
}

// Validate phone number format
function isValidPhoneNumber(phone) {
    const cleaned = phone.replace(/\D/g, '');
    const phoneRegex = /^216\d{8}$/;
    return phoneRegex.test(cleaned);
}

// Search for existing student
async function run(event) {
    event.preventDefault();
    
    let phoneInput = document.getElementById('telephone').value.trim();
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnLoading = document.getElementById('btnLoading');
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');
    const resultContent = document.getElementById('resultContent');
    
    successMessage.style.display = 'none';
    errorMessage.style.display = 'none';
    
    // Validate and format phone number
    const phoneNumber = formatPhoneNumber(phoneInput);
    
    if (!phoneNumber) {
        errorMessage.style.display = 'block';
        document.getElementById('errorText').textContent = 
            '✗ Format de téléphone invalide. Veuillez entrer un numéro valide (ex: 93195501 ou 21693195501).';
        return;
    }
    
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline-block';
    
    try {
        const apiUrl = `/.netlify/functions/search?phone=${encodeURIComponent(phoneNumber)}`;
        const response = await fetch(apiUrl);
        
        // Check if response is OK
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            resultContent.innerHTML = `
                <div class="student-info">
                    <p><strong>Nom complet:</strong> ${escapeHtml(data.data.full_name)}</p>
                    <p><strong>Établissement:</strong> ${escapeHtml(data.data.university)}</p>
                    <p><strong>Position:</strong> ${escapeHtml(data.data.position || 'N/A')}</p>
                    <p><strong>Département:</strong> ${escapeHtml(data.data.member || 'N/A')}</p>
                    <p><strong>Participe à JNA:</strong> ${escapeHtml(data.data.participates_in_jna)}</p>
                </div>
            `;
            successMessage.style.display = 'block';
            errorMessage.style.display = 'none';
        } else {
            errorMessage.style.display = 'block';
            document.getElementById('errorText').textContent = 
                '✗ Numéro de téléphone non trouvé. Veuillez vérifier et réessayer.';
        }
    } catch (error) {
        console.error('Error:', error);
        errorMessage.style.display = 'block';
        document.getElementById('errorText').textContent = 
            '✗ Une erreur est survenue. Veuillez réessayer.';
    } finally {
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Show registration form
function showRegistrationForm() {
    const searchPhone = document.getElementById('telephone').value.trim();
    const formatted = formatPhoneNumber(searchPhone);
    
    if (formatted) {
        document.getElementById('regPhone').value = formatted;
    }
    
    document.getElementById('searchSection').style.display = 'none';
    document.getElementById('registrationSection').style.display = 'block';
}

// Hide registration form
function hideRegistrationForm() {
    document.getElementById('registrationSection').style.display = 'none';
    document.getElementById('searchSection').style.display = 'block';
    document.getElementById('registrationSuccess').style.display = 'none';
    document.getElementById('registrationError').style.display = 'none';
}

// Submit new registration
async function submitNewRegistration(event) {
    event.preventDefault();
    
    const submitBtn = document.getElementById('submitRegBtn');
    const btnText = document.getElementById('regBtnText');
    const btnLoading = document.getElementById('regBtnLoading');
    const successMessage = document.getElementById('registrationSuccess');
    const errorMessage = document.getElementById('registrationError');
    
    successMessage.style.display = 'none';
    errorMessage.style.display = 'none';
    
    // Validate form fields
    const fullName = document.getElementById('regFullName').value.trim();
    const phoneInput = document.getElementById('regPhone').value.trim();
    const university = document.getElementById('regUniversity').value.trim();
    const position = document.getElementById('regPosition').value.trim();
    const member = document.getElementById('regMember').value.trim();
    const participates = document.getElementById('regParticipates').value;
    
    // Validate required fields
    if (!fullName || fullName.length < 2 || fullName.length > 100) {
        errorMessage.style.display = 'block';
        document.getElementById('registrationErrorText').textContent = 
            '✗ Nom invalide (2-100 caractères).';
        return;
    }
    
    if (!university || university.length < 2 || university.length > 100) {
        errorMessage.style.display = 'block';
        document.getElementById('registrationErrorText').textContent = 
            '✗ Établissement invalide (2-100 caractères).';
        return;
    }
    
    if (!participates || (participates !== 'OUI' && participates !== 'NON')) {
        errorMessage.style.display = 'block';
        document.getElementById('registrationErrorText').textContent = 
            '✗ Veuillez sélectionner une option pour la participation à JNA.';
        return;
    }
    
    // Validate and format phone number
    const phoneNumber = formatPhoneNumber(phoneInput);
    if (!phoneNumber) {
        errorMessage.style.display = 'block';
        document.getElementById('registrationErrorText').textContent = 
            '✗ Numéro de téléphone invalide.';
        return;
    }
    
    // Validate optional fields length
    if (position && (position.length < 2 || position.length > 100)) {
        errorMessage.style.display = 'block';
        document.getElementById('registrationErrorText').textContent = 
            '✗ Position invalide (2-100 caractères).';
        return;
    }
    
    if (member && (member.length < 2 || member.length > 200)) {
        errorMessage.style.display = 'block';
        document.getElementById('registrationErrorText').textContent = 
            '✗ Département invalide (2-200 caractères).';
        return;
    }
    
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline-block';
    
    const registrationData = {
        full_name: fullName,
        phone_number: phoneNumber,
        university: university,
        position: position || '',
        member: member || '',
        participates_in_jna: participates
    };
    
    try {
        const response = await fetch('/.netlify/functions/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(registrationData)
        });
        
        // Check if response is OK
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            successMessage.style.display = 'block';
            document.getElementById('newRegistrationForm').reset();
        } else {
            errorMessage.style.display = 'block';
            document.getElementById('registrationErrorText').textContent = 
                data.message || '✗ Une erreur est survenue. Veuillez réessayer.';
        }
    } catch (error) {
        console.error('Error:', error);
        errorMessage.style.display = 'block';
        document.getElementById('registrationErrorText').textContent = 
            '✗ Erreur de connexion. Veuillez vérifier votre connexion internet.';
    } finally {
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}

// Reset all forms and go back to search
function resetAllForms() {
    document.getElementById('telephone').value = '';
    document.getElementById('newRegistrationForm').reset();
    document.getElementById('registrationSection').style.display = 'none';
    document.getElementById('searchSection').style.display = 'block';
    document.getElementById('successMessage').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('registrationSuccess').style.display = 'none';
    document.getElementById('registrationError').style.display = 'none';
}
