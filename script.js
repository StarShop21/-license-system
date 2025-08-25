document.addEventListener('DOMContentLoaded', function() {
    // Sprawdź czy użytkownik jest zalogowany
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'login.html';
        return;
    }
    
    // Ustaw nazwę użytkownika
    const username = localStorage.getItem('username') || 'Administrator';
    document.getElementById('current-user').textContent = username;
    
    // Zmienne globalne
    let licenses = [];
    let currentLicenseToDelete = null;
    
    // Elementy DOM
    const licenseForm = document.getElementById('license-form');
    const licenseKeyInput = document.getElementById('license-key');
    const generateKeyBtn = document.getElementById('generate-key');
    const licensesTable = document.getElementById('licenses-table');
    const searchInput = document.getElementById('search-license');
    const filterStatus = document.getElementById('filter-status');
    const deleteModal = document.getElementById('delete-modal');
    const licenseToDeleteSpan = document.getElementById('license-to-delete');
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    const cancelDeleteBtn = document.getElementById('cancel-delete');
    const closeModalBtn = document.querySelector('.close');
    
    // Statystyki
    const totalLicensesElement = document.getElementById('total-licenses');
    const activeLicensesElement = document.getElementById('active-licenses');
    const expiredLicensesElement = document.getElementById('expired-licenses');
    
    // Inicjalizacja
    loadLicenses();
    setupEventListeners();
    
    // Funkcja inicjalizująca nasłuchiwacze zdarzeń
    function setupEventListeners() {
        // Formularz dodawania licencji
        licenseForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addLicense();
        });
        
        // Przycisk generowania klucza
        if (generateKeyBtn) {
            generateKeyBtn.addEventListener('click', generateLicenseKey);
        }
        
        // Wyszukiwanie i filtrowanie
        searchInput.addEventListener('input', filterLicenses);
        filterStatus.addEventListener('change', filterLicenses);
        
        // Modal usuwania
        confirmDeleteBtn.addEventListener('click', deleteLicense);
        cancelDeleteBtn.addEventListener('click', closeModal);
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeModal);
        }
        
        // Zamknij modal po kliknięciu poza obszarem
        window.addEventListener('click', function(e) {
            if (e.target === deleteModal) {
                closeModal();
            }
        });
    }
    
    // Ładowanie licencji z serwera
    function loadLicenses() {
        console.log('Ładowanie licencji z serwera...');
        
        fetch('server.php?action=getLicenses')
            .then(response => {
                console.log('Status odpowiedzi:', response.status);
                if (!response.ok) {
                    throw new Error('Błąd HTTP: ' + response.status);
                }
                return response.json();
            })
            .then(data => {
                console.log('Otrzymane dane:', data);
                if (data.success) {
                    licenses = data.data;
                    updateStatistics();
                    renderLicensesTable(licenses);
                    console.log('Licencje załadowane z serwera:', licenses.length);
                } else {
                    console.error('Błąd podczas ładowania licencji:', data.error);
                    // Dane demonstracyjne w przypadku błędu
                    loadDemoData();
                }
            })
            .catch(error => {
                console.error('Błąd pobierania licencji:', error);
                loadDemoData();
            });
    }
    
    // Dane demonstracyjne w przypadku błędu
    function loadDemoData() {
        console.warn('Używanie danych demonstracyjnych');
        
        const mockLicenses = [
            {
                id: 1,
                key: 'AX7B-9C7D-4E3F-G2H1',
                hwid: '9A8B7C6D5E4F',
                expires_at: '2025-08-22 16:00:00',
                created_at: '2024-01-01 10:00:00',
                status: 'active'
            },
            {
                id: 2,
                key: 'JK3L-M8N9-O1P2-Q3R4',
                hwid: null,
                expires_at: '2024-05-15 12:00:00',
                created_at: '2024-01-02 11:00:00',
                status: 'expired'
            }
        ];
        
        licenses = mockLicenses;
        updateStatistics();
        renderLicensesTable(licenses);
        alert('Uwaga: Używane są dane demonstracyjne. Sprawdź połączenie z serwerem.');
    }
    
    // Generowanie losowego klucza licencji
    function generateLicenseKey() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let key = '';
        
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                key += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            if (i < 3) key += '-';
        }
        
        if (licenseKeyInput) {
            licenseKeyInput.value = key;
            licenseKeyInput.focus();
        } else {
            console.error('Element license-key nie znaleziony');
        }
    }
    
    // Dodawanie nowej licencji
    function addLicense() {
        const licenseKey = licenseKeyInput ? licenseKeyInput.value.trim() : '';
        const expirationInput = document.getElementById('expiration');
        const expiration = expirationInput ? expirationInput.value : '';
        const hwidInput = document.getElementById('hwid');
        const hwid = hwidInput ? hwidInput.value.trim() : '';
        
        console.log('Dodawanie licencji:', { licenseKey, expiration, hwid });
        
        if (!licenseKey) {
            alert('Proszę wprowadzić klucz licencji');
            return;
        }
        
        if (!expiration) {
            alert('Proszę wybrać datę wygaśnięcia licencji');
            return;
        }
        
        // Sprawdź czy klucz już istnieje (lokalnie)
        if (licenses.some(license => license.key === licenseKey)) {
            alert('Klucz licencji już istnieje! Proszę użyć innego.');
            return;
        }
        
        const newLicense = {
            key: licenseKey,
            hwid: hwid || null,
            expires_at: expiration.replace('T', ' ') + ':00'
        };
        
        console.log('Wysyłanie do serwera:', newLicense);
        
        // Wyślij do serwera
        fetch('server.php?action=addLicense', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newLicense)
        })
        .then(response => {
            console.log('Status odpowiedzi dodawania:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('Odpowiedź serwera dodawania:', data);
            if (data.success) {
                // Odśwież listę licencji
                loadLicenses();
                
                // Reset formularza
                if (licenseForm) {
                    licenseForm.reset();
                }
                
                // Powiadomienie o sukcesie
                alert(`Licencja została pomyślnie dodana: ${licenseKey}`);
                
                // Ponownie wygeneruj klucz
                setTimeout(generateLicenseKey, 100);
            } else {
                alert('Błąd podczas dodawania licencji: ' + (data.error || 'Nieznany błąd'));
            }
        })
        .catch(error => {
            console.error('Błąd dodawania licencji:', error);
            alert('Błąd połączenia z serwerem podczas dodawania licencji');
        });
    }
    
    // Filtrowanie licencji
    function filterLicenses() {
        const searchText = searchInput.value.toLowerCase();
        const statusFilter = filterStatus.value;
        
        let filteredLicenses = licenses.filter(license => {
            const matchesSearch = license.key.toLowerCase().includes(searchText) || 
                                 (license.hwid && license.hwid.toLowerCase().includes(searchText));
            
            // Sprawdź status licencji na podstawie daty
            const now = new Date();
            const expirationDate = new Date(license.expires_at);
            const isActive = now <= expirationDate;
            const status = isActive ? 'active' : 'expired';
            
            const matchesStatus = statusFilter === 'all' || status === statusFilter;
            
            return matchesSearch && matchesStatus;
        });
        
        renderLicensesTable(filteredLicenses);
    }
    
    // Renderowanie tabeli z licencjami
    function renderLicensesTable(licensesToRender) {
        const tbody = licensesTable.querySelector('tbody');
        if (!tbody) {
            console.error('Element tbody nie znaleziony');
            return;
        }
        
        tbody.innerHTML = '';
        
        if (licensesToRender.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="5" style="text-align: center; padding: 20px; color: #666;">Brak licencji spełniających kryteria</td>';
            tbody.appendChild(tr);
            return;
        }
        
        licensesToRender.forEach(license => {
            const tr = document.createElement('tr');
            
            // Formatowanie daty
            const expirationDate = new Date(license.expires_at);
            const formattedDate = expirationDate.toLocaleString('pl-PL');
            
            // Sprawdzenie statusu (ważności) licencji
            const now = new Date();
            const status = now > expirationDate ? 'expired' : 'active';
            const statusText = status === 'active' ? 'Aktywna' : 'Wygasła';
            
            tr.innerHTML = `
                <td>${license.key}</td>
                <td>${license.hwid || '<span style="color: #999; font-style: italic;">Nie przypisano</span>'}</td>
                <td>${formattedDate}</td>
                <td><span class="status ${status}">${statusText}</span></td>
                <td class="actions">
                    <button class="action-btn btn-danger delete-btn" data-id="${license.id}" data-key="${license.key}">
                        <i class="fas fa-trash"></i> Usuń
                    </button>
                </td>
            `;
            
            tbody.appendChild(tr);
        });
        
        // Dodanie nasłuchiwaczy do przycisków usuwania
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const licenseId = this.getAttribute('data-id');
                const licenseKey = this.getAttribute('data-key');
                showDeleteModal(licenseId, licenseKey);
            });
        });
    }
    
    // Aktualizacja statystyk
    function updateStatistics() {
        const now = new Date();
        
        const total = licenses.length;
        const active = licenses.filter(license => {
            try {
                const expirationDate = new Date(license.expires_at);
                return now <= expirationDate;
            } catch (e) {
                console.error('Błąd parsowania daty:', license.expires_at, e);
                return false;
            }
        }).length;
        const expired = total - active;
        
        if (totalLicensesElement) totalLicensesElement.textContent = total;
        if (activeLicensesElement) activeLicensesElement.textContent = active;
        if (expiredLicensesElement) expiredLicensesElement.textContent = expired;
    }
    
    // Pokazanie modalu potwierdzenia usunięcia
    function showDeleteModal(licenseId, licenseKey) {
        currentLicenseToDelete = { id: parseInt(licenseId), key: licenseKey };
        if (licenseToDeleteSpan) {
            licenseToDeleteSpan.textContent = licenseKey;
        }
        if (deleteModal) {
            deleteModal.style.display = 'flex';
        }
    }
    
    // Zamknięcie modalu
    function closeModal() {
        if (deleteModal) {
            deleteModal.style.display = 'none';
        }
        currentLicenseToDelete = null;
    }
    
    // Usuwanie licencji - NAPRAWIONE
    function deleteLicense() {
        if (!currentLicenseToDelete) {
            console.error('Brak licencji do usunięcia');
            return;
        }
        
        console.log('Rozpoczynanie usuwania licencji ID:', currentLicenseToDelete.id);
        
        // Użyj FormData zamiast JSON dla lepszej kompatybilności
        const formData = new FormData();
        formData.append('id', currentLicenseToDelete.id);
        
        fetch('server.php?action=deleteLicense', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            console.log('Status odpowiedzi usuwania:', response.status);
            if (!response.ok) {
                throw new Error('Błąd HTTP: ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            console.log('Odpowiedź serwera usuwania:', data);
            if (data.success) {
                // Odśwież listę licencji
                loadLicenses();
                closeModal();
                alert('Licencja została pomyślnie usunięta');
            } else {
                alert('Błąd podczas usuwania licencji: ' + (data.error || 'Nieznany błąd'));
                closeModal();
            }
        })
        .catch(error => {
            console.error('Błąd usuwania licencji:', error);
            alert('Błąd połączenia z serwerem podczas usuwania licencji. Sprawdź konsolę F12 dla szczegółów.');
            closeModal();
        });
    }

    // Testowanie połączenia przy starcie
    console.log('Aplikacja zainicjalizowana');
    console.log('Testowanie połączenia z server.php...');
    
    // Test dostępności server.php
    fetch('server.php?action=getLicenses')
        .then(response => {
            console.log('Server.php dostępny, status:', response.status);
            return response.text();
        })
        .then(text => {
            console.log('Odpowiedź server.php:', text.substring(0, 200) + '...');
        })
        .catch(error => {
            console.error('Błąd dostępu do server.php:', error);
        });
    
    // Automatycznie generuj klucz przy ładowaniu
    setTimeout(() => {
        if (generateKeyBtn) {
            generateLicenseKey();
        }
    }, 500);
});

// Funkcja wylogowania (dostępna globalnie)
function logout() {
    if (confirm('Czy na pewno chcesz się wylogować?')) {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('username');
        window.location.href = 'login.html';
    }
}

// Pomocnicza funkcja debugowania
function debugServer() {
    console.log('Testowanie serwera...');
    
    fetch('server.php?action=getLicenses')
        .then(response => {
            console.log('Status:', response.status);
            console.log('Headers:', Object.fromEntries([...response.headers]));
            return response.text();
        })
        .then(text => {
            console.log('Pełna odpowiedź:', text);
            try {
                const data = JSON.parse(text);
                console.log('Sparsowane dane:', data);
            } catch (e) {
                console.error('Błąd parsowania JSON:', e);
            }
        })
        .catch(error => {
            console.error('Błąd testowania serwera:', error);
        });
}

// Dodaj funkcję debugowania do globalnego scope dla łatwego dostępu
window.debugServer = debugServer;