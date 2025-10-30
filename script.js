async function run(event) {
    event.preventDefault();
    
    const phoneNumber = document.getElementById('telephone').value.trim();
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnLoading = document.getElementById('btnLoading');
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');
    const resultContent = document.getElementById('resultContent');
    
    successMessage.style.display = 'none';
    errorMessage.style.display = 'none';
    
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline-block';
    
    try {
        const apiUrl = `/.netlify/functions/search?phone=${encodeURIComponent(phoneNumber)}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.success) {
            resultContent.innerHTML = `
                
                    Nom complet: ${data.data.full_name}
                    Établissement: ${data.data.university}
                    Position: ${data.data.position || 'N/A'}
                    Département: ${data.data.member || 'N/A'}
                    Participe à JNA: ${data.data.participates_in_jna}
                
            `;
            successMessage.style.display = 'block';
        } else {
            errorMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Error:', error);
        errorMessage.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}