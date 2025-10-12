# Prompt: System Autentykacji - Nuxt 3 + TypeScript

Zbuduj kompletny system autentykacji i zarządzania użytkownikami w Nuxt 3 z TypeScript, Composition API i TailwindCSS.

## API Base URL
`http://localhost:3000/api`

---

## 📡 Endpointy API

### Auth Endpoints

| Endpoint | Method | Dostęp | Opis |
|----------|--------|--------|------|
| `/api/auth/register` | POST | Publiczny | Rejestracja użytkownika |
| `/api/auth/login` | POST | Publiczny | Logowanie (ustawia status online) |
| `/api/auth/refresh` | POST | Publiczny | Odświeżenie access token |
| `/api/auth/logout` | POST | Publiczny | Wylogowanie (ustawia status offline) |
| `/api/auth/me` | GET | 🔒 Chroniony | Pobiera dane zalogowanego użytkownika |

### User Endpoints

| Endpoint | Method | Dostęp | Opis |
|----------|--------|--------|------|
| `/api/users` | GET | 🔒 Chroniony | Lista użytkowników (paginacja) |
| `/api/users/:id` | GET | 🔒 Chroniony | Profil użytkownika |
| `/api/users/:id/status` | GET | 🔒 Chroniony | Status online/offline |
| `/api/users/:id` | PUT | 🔒 Własne | Aktualizacja profilu |
| `/api/users/:id/password` | PATCH | 🔒 Własne | Zmiana hasła |
| `/api/users/:id` | DELETE | 🔒 Własne | Usunięcie konta (soft delete) |

---

## 📝 Szczegóły Requestów/Response

### POST /api/auth/register
```typescript
// Request
{ email: string, username: string, password: string }

// Success (201)
{ success: true, message: "User registered successfully" }

// Walidacja: email (format), username (3-30 znaków), password (6-100 znaków)
```

### POST /api/auth/login
```typescript
// Request
{ email: string, password: string }

// Success (200)
{ 
  success: true, 
  message: "Login successful",
  data: { user: { id, username, email } }
}

// Cookies: accessToken (15min), refreshToken (7 days) - HttpOnly, Secure
```

### GET /api/auth/me
```typescript
// Success (200)
{
  success: true,
  data: {
    user: { email, username, createdAt, lastSeen }
  }
}
```

### GET /api/users?page=1&limit=10
```typescript
// Success (200)
{
  users: [{ id, email, username, createdAt, lastSeen }],
  pagination: {
    currentPage, totalPages, totalUsers, hasNext, hasPrev
  }
}
```

### PUT /api/users/:id
```typescript
// Request (username i/lub email)
{ username?: string, email?: string }

// Success (200)
{ message: "User updated successfully", user: {...} }
```

### PATCH /api/users/:id/password
```typescript
// Request
{ currentPassword: string, newPassword: string }

// Success (200)
{ message: "Password updated successfully" }

// Walidacja newPassword: 8+ znaków, 1 wielka, 1 mała, 1 cyfra, 1 znak specjalny
```

---

## 🎯 Wymagane Strony

### 1. `/register`
- Formularz: email, username, password
- Walidacja na żywo (email format, username 3-30, password 6-100)
- Po sukcesie → redirect `/login`

### 2. `/login`
- Formularz: email, password
- Po sukcesie → zapisz user w store → redirect `/dashboard`

### 3. `/dashboard` lub `/profile`
- Wyświetl dane użytkownika (GET /api/auth/me)
- **Edycja profilu:** formularz (username, email) + button "Zapisz" (PUT)
- **Zmiana hasła:** formularz (currentPassword, newPassword, confirmPassword) + button "Zmień" (PATCH)
- Button "Wyloguj" (POST logout → redirect `/login`)

### 4. `/users`
- Lista użytkowników z paginacją (GET /api/users?page=X)
- Dla każdego: avatar/inicjały, username, email, status online/offline (badge)
- Paginacja: Previous/Next, info "Strona X z Y"
- Button "Zobacz profil" → `/users/:id`

### 5. `/users/:id`
- Profil użytkownika (GET /api/users/:id)
- Status online/offline (GET /api/users/:id/status)
- Jeśli to Twój profil → button "Edytuj" → `/dashboard`

---

## 🛠️ Implementacja Techniczna

### TypeScript Types
```typescript
// types/auth.ts
interface User {
  id: string;
  email: string;
  username: string;
  createdAt: Date;
  lastSeen: Date | null;
}

interface LoginCredentials { email: string; password: string; }
interface RegisterData { email: string; username: string; password: string; }
interface UpdateProfileData { username?: string; email?: string; }
interface UpdatePasswordData { currentPassword: string; newPassword: string; }
interface UserStatus { status: 'online' | 'offline'; }
```

### Composable: `useAuth()`
```typescript
export function useAuth() {
  const user = useState<User | null>('auth-user', () => null);
  const isAuthenticated = computed(() => !!user.value);
  
  async function login(credentials: LoginCredentials) { /* POST /api/auth/login */ }
  async function register(data: RegisterData) { /* POST /api/auth/register */ }
  async function logout() { /* POST /api/auth/logout */ }
  async function checkAuth() { /* GET /api/auth/me */ }
  async function refreshToken() { /* POST /api/auth/refresh */ }
  
  return { user, isAuthenticated, login, register, logout, checkAuth, refreshToken };
}
```

### Composable: `useUser()`
```typescript
export function useUser() {
  async function getUserProfile(id: string) { /* GET /api/users/:id */ }
  async function getAllUsers(page: number, limit = 10) { /* GET /api/users */ }
  async function getUserStatus(id: string) { /* GET /api/users/:id/status */ }
  async function updateProfile(id: string, data: UpdateProfileData) { /* PUT */ }
  async function updatePassword(id: string, data: UpdatePasswordData) { /* PATCH */ }
  async function deleteUser(id: string) { /* DELETE */ }
  
  return { getUserProfile, getAllUsers, getUserStatus, updateProfile, updatePassword, deleteUser };
}
```

### Middleware: `auth.ts`
```typescript
// Chroni strony - redirect /login jeśli nie zalogowany
export default defineNuxtRouteMiddleware(async () => {
  const { checkAuth, isAuthenticated } = useAuth();
  await checkAuth();
  if (!isAuthenticated.value) return navigateTo('/login');
});
```

### Middleware: `guest.ts`
```typescript
// Redirect zalogowanych z /login i /register → /dashboard
export default defineNuxtRouteMiddleware(() => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated.value) return navigateTo('/dashboard');
});
```

### API Client z Auto-Refresh
```typescript
// utils/api.ts
const apiFetch = $fetch.create({
  baseURL: 'http://localhost:3000/api',
  credentials: 'include', // Wysyła cookies
  
  async onResponseError({ response }) {
    if (response.status === 401) {
      const { refreshToken } = useAuth();
      const refreshed = await refreshToken();
      if (!refreshed) await navigateTo('/login');
    }
  }
});
```

---

## 🎨 UI/UX Requirements

### Styling
- **TailwindCSS tylko** (NO CSS/`<style>` tags)
- Responsive (mobile-first)

### Accessibility
- Labels: `<label>` lub `aria-label` dla inputs
- Focusable: `tabindex="0"`
- Keyboard navigation
- Error messages: `aria-live="polite"`

### Event Handlers
- Prefix "handle": `handleLogin`, `handleSubmit`, `handlePasswordChange`

### Forms
- Walidacja on blur/change
- Błędy pod inputami
- Disable submit gdy invalid
- Loading state (spinner, disabled inputs)

### Error Handling
```typescript
// Composable: useErrorHandler()
function handleApiError(error: any) {
  if (error?.data?.message) toast.error(error.data.message);
  else if (error?.data?.details) {
    error.data.details.forEach(d => toast.error(`${d.field}: ${d.message}`));
  }
}
```

---

## 🔄 Flow Przykłady

**Logowanie:**
1. User → email + password
2. Walidacja → POST /api/auth/login
3. Success → zapisz user w store → redirect /dashboard
4. Error → toast z błędem

**Auto-Refresh Token:**
1. Request z wygasłym tokenem → 401
2. Interceptor → POST /api/auth/refresh
3. Success → powtórz request | Fail → logout + redirect /login

**Edycja Profilu:**
1. User zmienia username → "Zapisz"
2. Walidacja → PUT /api/users/:id
3. Success → update store + toast | Error 409 → "Username zajęty"

---

## ✅ Checklist

- [ ] Types/interfaces (auth.ts, user.ts)
- [ ] Composables: `useAuth()`, `useUser()`
- [ ] Middleware: `auth.ts`, `guest.ts`
- [ ] API client z auto-refresh (401 handler)
- [ ] Strony: `/register`, `/login`, `/dashboard`, `/users`, `/users/:id`
- [ ] Formularze z walidacją
- [ ] Loading states
- [ ] Error handling + toasts
- [ ] Responsive design
- [ ] Accessibility features

---

**Zaimplementuj kompletny kod bez TODO i placeholderów. Wszystkie funkcje w pełni działające.**

