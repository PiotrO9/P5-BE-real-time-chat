# 🚀 Express.js + TypeScript + WebSocket Server

Nowoczesny serwer Express.js z TypeScript i obsługą WebSocketów za pomocą Socket.IO.

## ✨ Funkcjonalności

- **Express.js** - Framework webowy dla Node.js
- **TypeScript** - Statyczne typowanie dla JavaScript
- **Socket.IO** - Dwukierunkowa komunikacja w czasie rzeczywistym
- **CORS** - Cross-Origin Resource Sharing
- **Nodemon** - Automatyczne restartowanie serwera podczas rozwoju

## 🛠️ Konfiguracja i uruchomienie

### Wymagania
- Node.js (v18 lub nowszy)
- npm

### Instalacja
```bash
npm install
```

### Uruchomienie w trybie deweloperskim
```bash
npm run dev
```

### Budowanie projektu
```bash
npm run build
```

### Uruchomienie w trybie produkcyjnym
```bash
npm run build
npm start
```

## 📡 API Endpoints

### HTTP REST API
- `GET /` - Sprawdzenie statusu serwera
- `GET /api/health` - Health check z dodatkowymi informacjami
- `GET /api/stats` - Statystyki serwera WebSocket

### WebSocket Events

#### Client → Server
- `joinRoom({ roomId: string, username: string })` - Dołączenie do pokoju
- `leaveRoom(roomId: string)` - Opuszczenie pokoju
- `sendMessage({ roomId: string, content: string })` - Wysłanie wiadomości
- `ping()` - Ping serwera

#### Server → Client
- `connected({ message: string, timestamp: Date })` - Potwierdzenie połączenia
- `userJoined(user: User)` - Nowy użytkownik dołączył do pokoju
- `userLeft(user: User)` - Użytkownik opuścił pokój
- `messageReceived(message: Message)` - Nowa wiadomość w pokoju
- `roomJoined(room: Room)` - Potwierdzenie dołączenia do pokoju
- `roomLeft(roomId: string)` - Potwierdzenie opuszczenia pokoju
- `roomUsers(users: User[])` - Lista użytkowników w pokoju
- `error(error: string)` - Komunikat błędu

## 🧪 Testowanie

### Test klient WebSocket
Otwórz przeglądarkę i przejdź do:
```
http://localhost:3000
```

Znajdziesz tam interaktywny klient WebSocket, który pozwala:
- Łączyć się z serwerem
- Dołączać do pokojów
- Wysyłać wiadomości
- Sprawdzać status użytkowników

### Przykład kodu klienta JavaScript
```javascript
const socket = io('http://localhost:3000');

// Połączenie
socket.on('connect', () => {
  console.log('Połączono z serwerem');
});

// Dołączenie do pokoju
socket.emit('joinRoom', { 
  roomId: 'room1', 
  username: 'JanKowalski' 
});

// Wysłanie wiadomości
socket.emit('sendMessage', { 
  roomId: 'room1', 
  content: 'Witaj świecie!' 
});

// Odbiór wiadomości
socket.on('messageReceived', (message) => {
  console.log(`${message.username}: ${message.content}`);
});
```

## 📁 Struktura projektu

```
src/
├── app.ts              # Główny plik aplikacji
├── routes/             # Routery Express
│   └── api.ts         # API endpoints
├── socket/             # Obsługa WebSocket
│   └── socketHandlers.ts
├── types/              # Definicje typów TypeScript
│   └── socket.types.ts
└── controllers/        # Kontrolery (do przyszłego rozwoju)

public/
└── index.html          # Test klient WebSocket

dist/                   # Skompilowane pliki (po npm run build)
```

## 🔧 Konfiguracja

### Zmienne środowiskowe
Stwórz plik `.env` (opcjonalnie):
```
PORT=3000
NODE_ENV=development
```

### TypeScript
Konfiguracja w `tsconfig.json` jest już skonfigurowana dla:
- ES2020 target
- CommonJS modules
- Ścisłe typowanie
- Source maps
- Dekoratory

### Socket.IO
- CORS włączony dla wszystkich origin
- Obsługa wielopokojowa
- Automatyczne czyszczenie pustych pokoi
- Przechowywanie użytkowników i wiadomości w pamięci

## 🚀 Dalszy rozwój

### Sugestie rozbudowy:
1. **Baza danych** - Integracja z MongoDB/PostgreSQL dla trwałego przechowywania
2. **Autoryzacja** - JWT tokens i system uprawnień
3. **Redis** - Dla skalowania WebSocket między wieloma instancjami
4. **Logi** - Winston lub podobna biblioteka do logowania
5. **Testy** - Jest, Supertest dla testów jednostkowych i integracyjnych
6. **Docker** - Konteneryzacja aplikacji
7. **API Rate limiting** - Ograniczenie liczby zapytań
8. **WebRTC** - Dla połączeń audio/video
9. **File upload** - Przesyłanie plików przez WebSocket
10. **Notifications** - System powiadomień push

## 📝 Licencja

ISC License

## 🤝 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

Enjoy building with WebSockets! 🎉