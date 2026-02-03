// Локальная база данных для Telegram регистрации
// Хранит данные в localStorage

interface TelegramUser {
  id: string
  telegram_id: number
  phone: string
  email?: string
  full_name: string
  role: 'client' | 'carrier'
  created_at: string
  telegram_verified: boolean
  telegram_verified_at?: string
}

interface TelegramSession {
  session_token: string
  phone: string
  code: string
  expires_at: string
  attempts: number
  created_at: string
}

class TelegramDB {
  private readonly USERS_KEY = 'telegram_users'
  private readonly SESSIONS_KEY = 'telegram_sessions'
  private readonly CODES_KEY = 'telegram_codes'

  // Генерация 5-значного кода
  generateCode(): string {
    return Math.floor(10000 + Math.random() * 90000).toString()
  }

  // Генерация UUID
  generateUUID(): string {
    return crypto.randomUUID()
  }

  // Создание пользователя
  createUser(telegramId: number, phone: string, fullName: string, role: 'client' | 'carrier'): TelegramUser {
    const users = this.getUsers()
    const existingUser = users.find(u => u.telegram_id === telegramId)
    
    if (existingUser) {
      return existingUser
    }

    const newUser: TelegramUser = {
      id: this.generateUUID(),
      telegram_id: telegramId,
      phone,
      full_name: fullName,
      role,
      created_at: new Date().toISOString(),
      telegram_verified: false
    }

    users.push(newUser)
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users))
    return newUser
  }

  // Получение всех пользователей
  getUsers(): TelegramUser[] {
    const data = localStorage.getItem(this.USERS_KEY)
    return data ? JSON.parse(data) : []
  }

  // Поиск пользователя по telegram_id
  findUserByTelegramId(telegramId: number): TelegramUser | undefined {
    const users = this.getUsers()
    return users.find(u => u.telegram_id === telegramId)
  }

  // Поиск пользователя по телефону
  findUserByPhone(phone: string): TelegramUser | undefined {
    const users = this.getUsers()
    return users.find(u => u.phone === phone)
  }

  // Обновление пользователя
  updateUser(userId: string, updates: Partial<TelegramUser>): TelegramUser | null {
    const users = this.getUsers()
    const index = users.findIndex(u => u.id === userId)
    
    if (index === -1) return null

    users[index] = { ...users[index], ...updates }
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users))
    return users[index]
  }

  // Создание сессии
  createSession(phone: string): { session_token: string; expires_at: string } {
    const sessions = this.getSessions()
    
    // Удаляем старые сессии для этого телефона
    const filteredSessions = sessions.filter(s => s.phone !== phone)
    
    const sessionToken = this.generateUUID()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 минут
    
    const newSession: TelegramSession = {
      session_token: sessionToken,
      phone,
      code: '', // Будет установлен позже
      expires_at: expiresAt,
      attempts: 0,
      created_at: new Date().toISOString()
    }

    filteredSessions.push(newSession)
    localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(filteredSessions))
    
    return { session_token: sessionToken, expires_at: expiresAt }
  }

  // Получение всех сессий
  getSessions(): TelegramSession[] {
    const data = localStorage.getItem(this.SESSIONS_KEY)
    return data ? JSON.parse(data) : []
  }

  // Поиск сессии
  findSession(sessionToken: string): TelegramSession | undefined {
    const sessions = this.getSessions()
    return sessions.find(s => s.session_token === sessionToken)
  }

  // Установка кода для сессии
  setSessionCode(sessionToken: string, code: string): boolean {
    const sessions = this.getSessions()
    const index = sessions.findIndex(s => s.session_token === sessionToken)
    
    if (index === -1) return false

    sessions[index].code = code
    localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions))
    return true
  }

  // Увеличение попыток
  incrementAttempts(sessionToken: string): boolean {
    const sessions = this.getSessions()
    const index = sessions.findIndex(s => s.session_token === sessionToken)
    
    if (index === -1) return false

    sessions[index].attempts += 1
    localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions))
    return true
  }

  // Удаление сессии
  deleteSession(sessionToken: string): boolean {
    const sessions = this.getSessions()
    const filteredSessions = sessions.filter(s => s.session_token !== sessionToken)
    localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(filteredSessions))
    return true
  }

  // Очистка истекших сессий
  cleanupExpiredSessions(): void {
    const sessions = this.getSessions()
    const now = new Date()
    const validSessions = sessions.filter(s => new Date(s.expires_at) > now)
    localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(validSessions))
  }

  // Проверка кода
  verifyCode(sessionToken: string, inputCode: string): { success: boolean; user?: TelegramUser; error?: string } {
    this.cleanupExpiredSessions()
    
    const session = this.findSession(sessionToken)
    if (!session) {
      return { success: false, error: 'Session not found' }
    }

    if (new Date(session.expires_at) < new Date()) {
      this.deleteSession(sessionToken)
      return { success: false, error: 'Session expired' }
    }

    if (session.attempts >= 5) {
      this.deleteSession(sessionToken)
      return { success: false, error: 'Too many attempts' }
    }

    if (session.code !== inputCode) {
      this.incrementAttempts(sessionToken)
      return { success: false, error: 'Invalid code' }
    }

    // Ищем пользователя по telegram_id (который должен быть установлен в сессии)
    const user = this.findUserByTelegramId(parseInt(session.code)) // Временно используем code как telegram_id
    if (!user) {
      return { success: false, error: 'User not found' }
    }

    // Обновляем пользователя
    this.updateUser(user.id, {
      telegram_verified: true,
      telegram_verified_at: new Date().toISOString()
    })

    // Удаляем сессию
    this.deleteSession(sessionToken)

    return { success: true, user }
  }

  // Получение статистики
  getStats(): { totalUsers: number; verifiedUsers: number; activeSessions: number } {
    const users = this.getUsers()
    const sessions = this.getSessions()
    
    return {
      totalUsers: users.length,
      verifiedUsers: users.filter(u => u.telegram_verified).length,
      activeSessions: sessions.filter(s => new Date(s.expires_at) > new Date()).length
    }
  }

  // Очистка всех данных
  clearAll(): void {
    localStorage.removeItem(this.USERS_KEY)
    localStorage.removeItem(this.SESSIONS_KEY)
    localStorage.removeItem(this.CODES_KEY)
  }
}

export const telegramDB = new TelegramDB()
export type { TelegramUser, TelegramSession }
