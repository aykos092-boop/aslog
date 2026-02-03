// Telegram API клиент - Mock версия для локального тестирования
const TELEGRAM_API_BASE = '/functions/v1/telegram-bot'

export interface CreateSessionRequest {
  phone: string
}

export interface CreateSessionResponse {
  success: boolean
  session_token?: string
  expires_at?: string
  telegram_link?: string
  error?: string
}

export interface VerifyCodeRequest {
  session_token: string
  code: string
}

export interface VerifyCodeResponse {
  success: boolean
  telegram_id?: number
  user?: any
  error?: string
}

// Отправка кода в реальный Telegram бот
async function sendCodeToTelegram(phone: string, code: string): Promise<void> {
  try {
    // Здесь будет реальная отправка в Telegram
    // Пока используем mock для демонстрации
    console.log(`📱 Отправка кода ${code} в Telegram для ${phone}`);
    
    // В реальном боте это будет отправка сообщения пользователю
    const message = `🔐 *Код подтверждения*\n\nВаш уникальный код для регистрации:\n\n*${code}*\n\nКод действителен 5 минут.\n\nВведите этот код на сайте для завершения регистрации.`;
    
    // Имитация отправки
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log(`✅ Код отправлен в Telegram @asloguzbot`);
  } catch (error) {
    console.error('Error sending code to Telegram:', error);
  }
}

// Mock создание сессии
export async function createTelegramSession(phone: string): Promise<CreateSessionResponse> {
  try {
    // Имитация задержки сети
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Генерируем моковые данные
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const telegramLink = `https://t.me/asloguzbot?start=${sessionToken}`;
    
    // Генерируем УНИКАЛЬНЫЙ код для этой сессии
    const uniqueCode = Math.floor(10000 + Math.random() * 90000).toString();
    
    // Сохраняем в localStorage для тестирования
    localStorage.setItem('mock_session', JSON.stringify({
      session_token: sessionToken,
      phone: phone,
      expires_at: expiresAt,
      unique_code: uniqueCode, // Сохраняем уникальный код
      attempts: 0, // Счетчик попыток
      created_at: new Date().toISOString()
    }));
    
    // НЕ показываем код пользователю - он должен прийти в Telegram
    
    // Отправляем код через реальный Telegram API
    await sendCodeToTelegram(phone, uniqueCode);
    
    return {
      success: true,
      session_token: sessionToken,
      expires_at: expiresAt,
      telegram_link: telegramLink
    };
  } catch (error) {
    console.error('Error creating mock session:', error);
    return { success: false, error: 'Network error' }
  }
}

// Mock проверка кода
export async function verifyTelegramCode(sessionToken: string, code: string): Promise<VerifyCodeResponse> {
  try {
    // Имитация задержки сети
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Валидация формата кода
    if (!code.match(/^\d{5}$/)) {
      return { success: false, error: 'Invalid code format. Use 5 digits' }
    }
    
    // Получаем сессию из localStorage
    const sessionData = localStorage.getItem('mock_session');
    if (!sessionData) {
      return { success: false, error: 'Session not found' }
    }
    
    const session = JSON.parse(sessionData);
    
    // Проверяем срок действия
    if (new Date(session.expires_at) < new Date()) {
      localStorage.removeItem('mock_session');
      return { success: false, error: 'Session expired' }
    }
    
    // Проверяем количество попыток
    if (session.attempts >= 3) {
      localStorage.removeItem('mock_session');
      return { success: false, error: 'Too many attempts. Session blocked.' }
    }
    
    // Проверяем УНИКАЛЬНЫЙ код
    if (code === session.unique_code) {
      // Успешная верификация
      localStorage.removeItem('mock_session');
      
      // Создаем мокового пользователя
      const mockUser = {
        id: crypto.randomUUID(),
        telegram_id: 123456789,
        phone: session.phone,
        full_name: `User ${session.phone}`,
        role: 'client',
        telegram_verified: true,
        telegram_verified_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      
      return {
        success: true,
        telegram_id: 123456789,
        user: mockUser
      };
    } else {
      // Увеличиваем количество попыток
      session.attempts += 1;
      localStorage.setItem('mock_session', JSON.stringify(session));
      
      const remainingAttempts = 3 - session.attempts;
      return { 
        success: false, 
        error: `Invalid code. ${remainingAttempts} attempts remaining.` 
      }
    }
  } catch (error) {
    console.error('Error verifying mock code:', error);
    return { success: false, error: 'Verification error' }
  }
}
