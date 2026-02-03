import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TelegramMessage {
  message_id: number
  from: {
    id: number
    is_bot: boolean
    first_name: string
    username?: string
    language_code?: string
  }
  chat: {
    id: number
    first_name?: string
    username?: string
    type: 'private'
  }
  date: number
  text: string
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: any
}

// Отправка сообщения в Telegram
async function sendTelegramMessage(chatId: number, text: string, parseMode?: string) {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN not found')
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  
  const body: any = {
    chat_id: chatId,
    text: text
  }

  if (parseMode) {
    body.parse_mode = parseMode
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Telegram API error: ${error}`)
  }

  return response.json()
}

// Создание сессии
async function createSession(phone: string): Promise<{ session_token: string; expires_at: string }> {
  try {
    const sessionToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 минут

    // Сохраняем в localStorage (для демонстрации)
    const sessions = JSON.parse(localStorage.getItem('telegram_sessions') || '[]')
    
    // Удаляем старые сессии для этого телефона
    const filteredSessions = sessions.filter((s: any) => s.phone !== phone)
    
    const newSession = {
      session_token: sessionToken,
      phone,
      expires_at: expiresAt,
      created_at: new Date().toISOString()
    }

    filteredSessions.push(newSession)
    localStorage.setItem('telegram_sessions', JSON.stringify(filteredSessions))

    return { session_token: sessionToken, expires_at: expiresAt }
  } catch (error) {
    console.error('Error creating session:', error)
    throw error
  }
}

// Генерация 5-значного кода
function generateCode(): string {
  return Math.floor(10000 + Math.random() * 90000).toString()
}

// Создание кода верификации
async function createVerificationCode(sessionToken: string, telegramId: number): Promise<string> {
  try {
    const code = generateCode()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 минут

    // Сохраняем код
    const codes = JSON.parse(localStorage.getItem('telegram_codes') || '[]')
    
    const newCode = {
      session_token: sessionToken,
      telegram_id: telegramId,
      code: code,
      expires_at: expiresAt,
      attempts: 0,
      created_at: new Date().toISOString()
    }

    codes.push(newCode)
    localStorage.setItem('telegram_codes', JSON.stringify(codes))

    return code
  } catch (error) {
    console.error('Error creating verification code:', error)
    throw error
  }
}

// Проверка кода верификации
async function verifyCode(sessionToken: string, inputCode: string): Promise<{ success: boolean; telegram_id?: number; error?: string }> {
  try {
    const codes = JSON.parse(localStorage.getItem('telegram_codes') || '[]')
    const codeData = codes.find((c: any) => c.session_token === sessionToken)

    if (!codeData) {
      return { success: false, error: 'Verification session not found' }
    }

    // Проверяем срок действия
    if (new Date(codeData.expires_at) < new Date()) {
      return { success: false, error: 'Code expired' }
    }

    // Проверяем количество попыток
    if (codeData.attempts >= 5) {
      return { success: false, error: 'Too many attempts' }
    }

    if (codeData.code !== inputCode) {
      // Увеличиваем количество попыток
      codeData.attempts += 1
      localStorage.setItem('telegram_codes', JSON.stringify(codes))
      return { success: false, error: 'Invalid code' }
    }

    // Успешная верификация - удаляем код
    const filteredCodes = codes.filter((c: any) => c.session_token !== sessionToken)
    localStorage.setItem('telegram_codes', JSON.stringify(filteredCodes))

    return { 
      success: true, 
      telegram_id: codeData.telegram_id 
    }
  } catch (error) {
    console.error('Error verifying code:', error)
    return { success: false, error: 'Verification error' }
  }
}

// Создание пользователя
async function createUser(telegramId: number, phone: string, fullName: string, role: 'client' | 'carrier') {
  try {
    const users = JSON.parse(localStorage.getItem('telegram_users') || '[]')
    
    // Проверяем что пользователя еще нет
    const existingUser = users.find((u: any) => u.telegram_id === telegramId)
    if (existingUser) {
      return existingUser
    }

    const newUser = {
      id: crypto.randomUUID(),
      telegram_id: telegramId,
      phone,
      full_name: fullName,
      role,
      created_at: new Date().toISOString(),
      telegram_verified: false
    }

    users.push(newUser)
    localStorage.setItem('telegram_users', JSON.stringify(users))

    return newUser
  } catch (error) {
    console.error('Error creating user:', error)
    throw error
  }
}

// Обработка команды /start с session_token
async function handleStartWithSession(chatId: number, sessionToken: string) {
  try {
    // Проверяем валидность сессии
    const sessions = JSON.parse(localStorage.getItem('telegram_sessions') || '[]')
    const session = sessions.find((s: any) => s.session_token === sessionToken)

    if (!session) {
      await sendTelegramMessage(chatId, "❌ Неверная или истекшая сессия. Начните заново на сайте.")
      return
    }

    // Проверяем срок действия сессии
    if (new Date(session.expires_at) < new Date()) {
      await sendTelegramMessage(chatId, "❌ Сессия истекла. Начните заново на сайте.")
      return
    }

    // Создаем пользователя
    const user = await createUser(chatId, session.phone, `User ${chatId}`, 'client')

    // Генерируем и отправляем код
    const code = await createVerificationCode(sessionToken, chatId)
    
    await sendTelegramMessage(
      chatId,
      `🔐 *Код подтверждения*\n\nВаш 5-значный код для регистрации:\n\n*${code}*\n\nКод действителен 5 минут.\n\nВведите этот код на сайте для завершения регистрации.`,
      'Markdown'
    )

    console.log(`Code sent for session ${sessionToken} to user ${chatId}`)
  } catch (error) {
    console.error('Error handling start with session:', error)
    await sendTelegramMessage(chatId, "❌ Произошла ошибка. Попробуйте позже.")
  }
}

// Обработка обычной команды /start
async function handleStart(chatId: number) {
  await sendTelegramMessage(
    chatId,
    "👋 Добро пожаловать в @asloguzbot!\n\n" +
    "Этот бот используется для регистрации на сайте Swift Ship Connect.\n\n" +
    "Пожалуйста, начните с сайта, чтобы получить ссылку с кодом сессии.\n\n" +
    "📱 *Как это работает:*\n" +
    "1. Введите номер телефона на сайте\n" +
    "2. Откройте ссылку с ботом\n" +
    "3. Получите 5-значный код\n" +
    "4. Введите код на сайте\n" +
    "5. ✅ Регистрация завершена!",
    'Markdown'
  )
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname

    // POST /telegram-bot/session - создание сессии
    if (path === '/session' && req.method === 'POST') {
      try {
        const { phone } = await req.json()

        if (!phone || typeof phone !== 'string') {
          return new Response(
            JSON.stringify({ success: false, error: 'Phone number is required' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          )
        }

        // Создаем сессию
        const { session_token, expires_at } = await createSession(phone)
        const telegramLink = `https://t.me/asloguzbot?start=${session_token}`

        return new Response(
          JSON.stringify({ 
            success: true, 
            session_token,
            expires_at,
            telegram_link
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      } catch (error) {
        console.error('Error in /session endpoint:', error)
        return new Response(
          JSON.stringify({ success: false, error: 'Internal server error' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }
    }

    // POST /telegram-bot/verify - проверка кода
    if (path === '/verify' && req.method === 'POST') {
      try {
        const { session_token, code } = await req.json()

        if (!session_token || !code || typeof session_token !== 'string' || typeof code !== 'string') {
          return new Response(
            JSON.stringify({ success: false, error: 'Session token and code are required' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          )
        }

        // Проверяем код
        const result = await verifyCode(session_token, code)

        if (!result.success) {
          return new Response(
            JSON.stringify({ success: false, error: result.error }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          )
        }

        // Успешная верификация - получаем пользователя
        const users = JSON.parse(localStorage.getItem('telegram_users') || '[]')
        const user = users.find((u: any) => u.telegram_id === result.telegram_id)

        return new Response(
          JSON.stringify({ 
            success: true, 
            telegram_id: result.telegram_id,
            user: user
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      } catch (error) {
        console.error('Error in /verify endpoint:', error)
        return new Response(
          JSON.stringify({ success: false, error: 'Internal server error' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }
    }

    // Telegram webhook handler
    if (path === '/webhook' && req.method === 'POST') {
      try {
        const update: TelegramUpdate = await req.json()
        
        if (update.message) {
          const message = update.message
          const text = message.text.trim()

          if (text === '/start') {
            await handleStart(message.chat.id)
          } else if (text.startsWith('/start ')) {
            const sessionToken = text.substring(7) // Убираем '/start '
            await handleStartWithSession(message.chat.id, sessionToken)
          } else {
            await sendTelegramMessage(
              message.chat.id,
              "❌ Неизвестная команда.\n\n" +
              "Используйте ссылку с сайта для начала процесса регистрации."
            )
          }
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        })
      } catch (error) {
        console.error('Error processing webhook:', error)
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        })
      }
    }

    // 404 для остальных путей
    return new Response(
      JSON.stringify({ success: false, error: 'Endpoint not found' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
