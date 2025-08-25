document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    
    // Sprawdź czy użytkownik jest już zalogowany
    if (localStorage.getItem('isLoggedIn') === 'true') {
        window.location.href = 'index.html';
    }
    
    // Obsługa formularza logowania
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        // Sprawdź dane logowania przez serwer
        checkCredentialsThroughServer(username, password);
    });
    
    // Funkcja sprawdzająca dane logowania przez serwer
    function checkCredentialsThroughServer(username, password) {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        
        fetch('server.php?action=login', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.authenticated) {
                // Zaloguj użytkownika
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('username', username);
                window.location.href = 'index.html';
            } else {
                alert('Błędna nazwa użytkownika lub hasło!');
            }
        })
        .catch(error => {
            console.error('Błąd logowania:', error);
            // Fallback do lokalnego sprawdzenia
            if (username === 'admin' && password === 'admin123') {
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('username', username);
                window.location.href = 'index.html';
            } else {
                alert('Błąd połączenia z serwerem. Sprawdź konsolę F12.');
            }
        });
    }
});

// Funkcja wylogowania (dostępna globalnie)
function logout() {
    if (confirm('Czy na pewno chcesz się wylogować?')) {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('username');
        window.location.href = 'login.html';
    }
}