class SimpleLicenseVerifier {
    constructor() {
        this.licenses = [];
        this.loadLicenses();
    }

    // Ładuje licencje z pliku
    async loadLicenses() {
        try {
            const response = await fetch('licenses.json');
            const data = await response.json();
            this.licenses = data.licenses;
            console.log('✅ Załadowano licencje:', this.licenses.length);
        } catch (error) {
            console.error('❌ Błąd ładowania licencji:', error);
        }
    }

    // GŁÓWNA FUNKCJA - weryfikuje licencję
    verifyLicense(licenseKey, hwid) {
        // Znajdź licencję po kluczu
        const license = this.licenses.find(l => l.key === licenseKey);
        
        // 1. Sprawdź czy licencja istnieje
        if (!license) {
            return {
                valid: false,
                error: 'LICENSE_NOT_FOUND',
                message: 'Nieprawidłowy klucz licencji'
            };
        }

        // 2. Sprawdź czy HWID się zgadza
        if (license.hwid !== hwid) {
            return {
                valid: false, 
                error: 'HWID_MISMATCH',
                message: 'Licencja nie jest przypisana do tego urządzenia'
            };
        }

        // 3. Sprawdź datę ważności
        const expirationDate = new Date(license.expires_at);
        const currentDate = new Date();

        if (currentDate > expirationDate) {
            return {
                valid: false,
                error: 'LICENSE_EXPIRED',
                message: 'Licencja wygasła',
                expires_at: license.expires_at
            };
        }

        // ✅ WSZYSTKO OK - licencja poprawna
        return {
            valid: true,
            message: 'Licencja poprawna',
            expires_at: license.expires_at,
            customer: license.customer
        };
    }

    // Pobiera informacje o licencji (bez weryfikacji)
    getLicenseInfo(licenseKey) {
        const license = this.licenses.find(l => l.key === licenseKey);
        return license || null;
    }

    // Sprawdza czy HWID ma jakąś aktywną licencję
    checkHwid(hwid) {
        const currentDate = new Date();
        return this.licenses.filter(license => 
            license.hwid === hwid && 
            new Date(license.expires_at) > currentDate
        );
    }
}

// Tworzy globalną instancję
window.LicenseSystem = new SimpleLicenseVerifier();

// Krótkie aliasy dla szybkiego dostępu
window.verifyLicense = (key, hwid) => LicenseSystem.verifyLicense(key, hwid);
window.getLicenseInfo = (key) => LicenseSystem.getLicenseInfo(key);
