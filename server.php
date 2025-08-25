<?php
// DEBUG - zapisz informację o żądaniu
file_put_contents('debug.log', date('Y-m-d H:i:s') . ' - ' . $_SERVER['REQUEST_METHOD'] . ' ' . $_SERVER['REQUEST_URI'] . PHP_EOL, FILE_APPEND);

// Włącz pełne logowanie błędów
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

// Nagłówki CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

// Obsłuż żądanie OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit;
}


// Pliki do przechowywania danych
$licensesFile = 'licenses.json';
$usersFile = 'users.json';

// Funkcja do wysyłania odpowiedzi JSON
function sendJsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// Inicjalizacja plików danych
function initDataFile($file, $defaultData = []) {
    if (!file_exists($file)) {
        file_put_contents($file, json_encode($defaultData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
}

// Odczyt danych z pliku
function readData($file) {
    initDataFile($file);
    $json = file_get_contents($file);
    if ($json === false) {
        return [];
    }
    $data = json_decode($json, true);
    return is_array($data) ? $data : [];
}

// Zapis danych do pliku
function saveData($file, $data) {
    $result = file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    return $result !== false;
}

// Generowanie ID
function generateId($data) {
    if (empty($data)) {
        return 1;
    }
    $ids = array_column($data, 'id');
    return empty($ids) ? 1 : (max($ids) + 1);
}

// Sprawdzanie czy licencja już istnieje
function licenseExists($licenses, $key, $excludeId = null) {
    foreach ($licenses as $license) {
        if (isset($license['key']) && $license['key'] === $key) {
            if ($excludeId === null || $license['id'] != $excludeId) {
                return true;
            }
        }
    }
    return false;
}

// Sprawdzanie czy użytkownik już istnieje
function userExists($users, $username, $excludeId = null) {
    foreach ($users as $user) {
        if (isset($user['username']) && $user['username'] === $username) {
            if ($excludeId === null || $user['id'] != $excludeId) {
                return true;
            }
        }
    }
    return false;
}

// Sprawdzanie poświadczeń użytkownika
function checkCredentials($users, $username, $password) {
    foreach ($users as $user) {
        if (isset($user['username']) && $user['username'] === $username) {
            if (isset($user['password']) && $user['password'] === $password) {
                return true;
            }
        }
    }
    return false;
}

// Pobierz dane wejściowe
$input = [];
$inputData = file_get_contents('php://input');

if (!empty($inputData)) {
    $input = json_decode($inputData, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        sendJsonResponse(['success' => false, 'error' => 'Nieprawidłowy format JSON'], 400);
    }
}

// Pobierz metodę i akcję
$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

// Inicjalizuj domyślnego użytkownika jeśli nie istnieje
initDataFile($usersFile, [
    [
        'id' => 1,
        'username' => 'admin',
        'password' => 'admin123',
        'created_at' => date('Y-m-d H:i:s')
    ]
]);

// Przetwarzanie żądania
try {
    if ($method == 'GET') {
        switch ($action) {
            case 'getLicenses':
                $licenses = readData($licensesFile);
                sendJsonResponse(['success' => true, 'data' => $licenses]);
                break;
                
            case 'getLicense':
                if (!isset($_GET['id'])) {
                    sendJsonResponse(['success' => false, 'error' => 'Brak ID licencji'], 400);
                }
                
                $licenseId = intval($_GET['id']);
                $licenses = readData($licensesFile);
                
                foreach ($licenses as $license) {
                    if ($license['id'] === $licenseId) {
                        sendJsonResponse(['success' => true, 'license' => $license]);
                    }
                }
                
                sendJsonResponse(['success' => false, 'message' => 'Licencja nie znaleziona'], 404);
                break;
                
            case 'verifyLicense':
                if (!isset($_GET['key']) || !isset($_GET['hwid'])) {
                    sendJsonResponse(['valid' => false, 'error' => 'Brak klucza licencji lub HWID'], 400);
                }
                
                $licenseKey = $_GET['key'];
                $hwid = $_GET['hwid'];
                $licenses = readData($licensesFile);
                
                // Znajdź licencję
                $foundLicense = null;
                foreach ($licenses as $license) {
                    if ($license['key'] === $licenseKey) {
                        $foundLicense = $license;
                        break;
                    }
                }
                
                if (!$foundLicense) {
                    sendJsonResponse(['valid' => false, 'message' => 'Nieprawidłowy klucz licencji'], 404);
                }
                
                // Sprawdź datę wygaśnięcia
                $expirationDate = new DateTime($foundLicense['expires_at']);
                $currentDate = new DateTime();
                
                if ($currentDate > $expirationDate) {
                    sendJsonResponse(['valid' => false, 'message' => 'Licencja wygasła'], 403);
                }
                
                // Sprawdź HWID
                if (!empty($foundLicense['hwid'])) {
                    if ($foundLicense['hwid'] !== $hwid) {
                        sendJsonResponse(['valid' => false, 'message' => 'Licencja nie jest przypisana do tego komputera'], 403);
                    }
                } else {
                    // Jeśli licencja nie ma przypisanego HWID, przypisz go
                    $licenses = array_map(function($license) use ($licenseKey, $hwid) {
                        if ($license['key'] === $licenseKey) {
                            $license['hwid'] = $hwid;
                        }
                        return $license;
                    }, $licenses);
                    
                    saveData($licensesFile, $licenses);
                }
                
                sendJsonResponse([
                    'valid' => true, 
                    'message' => 'Licencja aktywna',
                    'license' => $foundLicense
                ]);
                break;
                
            case 'getLicenseInfo':
                if (!isset($_GET['key'])) {
                    sendJsonResponse(['success' => false, 'error' => 'Brak klucza licencji'], 400);
                }
                
                $licenseKey = $_GET['key'];
                $licenses = readData($licensesFile);
                
                foreach ($licenses as $license) {
                    if ($license['key'] === $licenseKey) {
                        sendJsonResponse(['success' => true, 'license' => $license]);
                    }
                }
                
                sendJsonResponse(['success' => false, 'message' => 'Licencja nie znaleziona'], 404);
                break;
                
            case 'getUsers':
                $users = readData($usersFile);
                // Usuń hasła z odpowiedzi dla bezpieczeństwa
                $usersWithoutPasswords = array_map(function($user) {
                    unset($user['password']);
                    return $user;
                }, $users);
                sendJsonResponse(['success' => true, 'data' => $usersWithoutPasswords]);
                break;
                
            case 'checkAuth':
                if (!isset($_GET['username']) || !isset($_GET['password'])) {
                    sendJsonResponse(['success' => false, 'error' => 'Brak nazwy użytkownika lub hasła'], 400);
                }
                
                $username = $_GET['username'];
                $password = $_GET['password'];
                $users = readData($usersFile);
                
                if (checkCredentials($users, $username, $password)) {
                    sendJsonResponse(['success' => true, 'authenticated' => true]);
                } else {
                    sendJsonResponse(['success' => false, 'authenticated' => false], 401);
                }
                break;
                
            default:
                sendJsonResponse(['success' => false, 'error' => 'Nieznana akcja GET'], 400);
                break;
        }
    } 
    else if ($method == 'POST') {
        switch ($action) {
            case 'addLicense':
                if (!isset($input['key']) || empty($input['key']) || !isset($input['expires_at']) || empty($input['expires_at'])) {
                    sendJsonResponse(['success' => false, 'error' => 'Brak wymaganych pól: key lub expires_at'], 400);
                }
                
                $licenses = readData($licensesFile);
                
                // Sprawdź czy klucz już istnieje
                if (licenseExists($licenses, $input['key'])) {
                    sendJsonResponse(['success' => false, 'error' => 'Klucz licencji już istnieje'], 409);
                }
                
                $newLicense = [
                    'id' => generateId($licenses),
                    'key' => $input['key'],
                    'hwid' => isset($input['hwid']) ? $input['hwid'] : null,
                    'expires_at' => $input['expires_at'],
                    'created_at' => date('Y-m-d H:i:s'),
                    'status' => 'active'
                ];
                
                $licenses[] = $newLicense;
                if (saveData($licensesFile, $licenses)) {
                    sendJsonResponse(['success' => true, 'message' => 'Licencja dodana pomyślnie', 'license' => $newLicense]);
                } else {
                    sendJsonResponse(['success' => false, 'error' => 'Błąd zapisu danych'], 500);
                }
                break;
                
            case 'addUser':
                if (!isset($input['username']) || empty($input['username']) || !isset($input['password']) || empty($input['password'])) {
                    sendJsonResponse(['success' => false, 'error' => 'Brak wymaganych pól: username lub password'], 400);
                }
                
                $users = readData($usersFile);
                
                // Sprawdź czy użytkownik już istnieje
                if (userExists($users, $input['username'])) {
                    sendJsonResponse(['success' => false, 'error' => 'Użytkownik już istnieje'], 409);
                }
                
                $newUser = [
                    'id' => generateId($users),
                    'username' => $input['username'],
                    'password' => $input['password'],
                    'created_at' => date('Y-m-d H:i:s')
                ];
                
                $users[] = $newUser;
                if (saveData($usersFile, $users)) {
                    // Usuń hasło z odpowiedzi
                    unset($newUser['password']);
                    sendJsonResponse(['success' => true, 'message' => 'Użytkownik dodany pomyślnie', 'user' => $newUser]);
                } else {
                    sendJsonResponse(['success' => false, 'error' => 'Błąd zapisu danych'], 500);
                }
                break;
                
            case 'login':
                if (!isset($input['username']) || empty($input['username']) || !isset($input['password']) || empty($input['password'])) {
                    sendJsonResponse(['success' => false, 'error' => 'Brak nazwy użytkownika lub hasła'], 400);
                }
                
                $username = $input['username'];
                $password = $input['password'];
                $users = readData($usersFile);
                
                if (checkCredentials($users, $username, $password)) {
                    sendJsonResponse(['success' => true, 'authenticated' => true, 'username' => $username]);
                } else {
                    sendJsonResponse(['success' => false, 'authenticated' => false], 401);
                }
                break;

            case 'deleteLicense':
                if (!isset($input['id'])) {
                    sendJsonResponse(['success' => false, 'error' => 'Brak ID licencji'], 400);
                }
                
                $licenseId = intval($input['id']);
                $licenses = readData($licensesFile);
                $initialCount = count($licenses);
                
                // Filtruj usuwając licencję o podanym ID
                $filteredLicenses = array_filter($licenses, function($license) use ($licenseId) {
                    return $license['id'] !== $licenseId;
                });
                
                // Sprawdź czy coś zostało usunięte
                if (count($filteredLicenses) === $initialCount) {
                    sendJsonResponse(['success' => false, 'error' => 'Licencja nie znaleziona'], 404);
                }
                
                if (saveData($licensesFile, array_values($filteredLicenses))) {
                    sendJsonResponse(['success' => true, 'message' => 'Licencja usunięta pomyślnie']);
                } else {
                    sendJsonResponse(['success' => false, 'error' => 'Błąd zapisu danych'], 500);
                }
                break;
                
            default:
                sendJsonResponse(['success' => false, 'error' => 'Nieznana akcja POST'], 400);
                break;
        }
    } 
    else if ($method == 'DELETE') {
        // Obsługa metody DELETE dla zgodności z REST
        parse_str(file_get_contents('php://input'), $input);
        
        switch ($action) {
            case 'deleteLicense':
                if (!isset($input['id'])) {
                    sendJsonResponse(['success' => false, 'error' => 'Brak ID licencji'], 400);
                }
                
                $licenseId = intval($input['id']);
                $licenses = readData($licensesFile);
                $initialCount = count($licenses);
                
                $filteredLicenses = array_filter($licenses, function($license) use ($licenseId) {
                    return $license['id'] !== $licenseId;
                });
                
                if (count($filteredLicenses) === $initialCount) {
                    sendJsonResponse(['success' => false, 'error' => 'Licencja nie znaleziona'], 404);
                }
                
                if (saveData($licensesFile, array_values($filteredLicenses))) {
                    sendJsonResponse(['success' => true, 'message' => 'Licencja usunięta pomyślnie']);
                } else {
                    sendJsonResponse(['success' => false, 'error' => 'Błąd zapisu danych'], 500);
                }
                break;
                
            case 'deleteUser':
                if (!isset($input['id'])) {
                    sendJsonResponse(['success' => false, 'error' => 'Brak ID użytkownika'], 400);
                }
                
                $userId = intval($input['id']);
                $users = readData($usersFile);
                
                // Nie pozwól usunąć ostatniego użytkownika
                if (count($users) <= 1) {
                    sendJsonResponse(['success' => false, 'error' => 'Nie można usunąć ostatniego użytkownika'], 400);
                }
                
                $initialCount = count($users);
                $filteredUsers = array_filter($users, function($user) use ($userId) {
                    return $user['id'] !== $userId;
                });
                
                if (count($filteredUsers) === $initialCount) {
                    sendJsonResponse(['success' => false, 'error' => 'Użytkownik nie znaleziony'], 404);
                }
                
                if (saveData($usersFile, array_values($filteredUsers))) {
                    sendJsonResponse(['success' => true, 'message' => 'Użytkownik usunięty pomyślnie']);
                } else {
                    sendJsonResponse(['success' => false, 'error' => 'Błąd zapisu danych'], 500);
                }
                break;
                
            default:
                sendJsonResponse(['success' => false, 'error' => 'Nieznana akcja DELETE'], 400);
                break;
        }
    } 
    else {
        sendJsonResponse(['success' => false, 'error' => 'Metoda nieobsługiwana: ' . $method], 405);
    }
} catch (Exception $e) {
    sendJsonResponse(['success' => false, 'error' => 'Wewnętrzny błąd serwera: ' . $e->getMessage()], 500);
}
?>