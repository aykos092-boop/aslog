// Mock Telegram Bot для локального тестирования
// Имитирует отправку кода в Telegram

export class MockTelegramBot {
  private static instance: MockTelegramBot;
  
  static getInstance(): MockTelegramBot {
    if (!MockTelegramBot.instance) {
      MockTelegramBot.instance = new MockTelegramBot();
    }
    return MockTelegramBot.instance;
  }

  // Отправка кода в Telegram (мок)
  async sendCode(phone: string, code: string): Promise<boolean> {
    try {
      // Имитация отправки в Telegram
      console.log(`📱 Telegram @asloguzbot отправляет код ${code} на номер ${phone}`);
      
      // Показываем в консоли для тестирования
      console.log(`\n🔐 МОК: Telegram бот отправил сообщение:`);
      console.log(`📱 Кому: ${phone}`);
      console.log(`📨 Текст: Ваш уникальный код для регистрации: ${code}`);
      console.log(`⏰ Время: ${new Date().toLocaleString()}`);
      console.log(`🤖 От: @asloguzbot\n`);
      
      // Имитация задержки отправки
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return true;
    } catch (error) {
      console.error('Error sending mock Telegram message:', error);
      return false;
    }
  }

  // Получение кода из localStorage (для тестирования)
  getGeneratedCode(): string | null {
    try {
      const sessionData = localStorage.getItem('mock_session');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        return session.unique_code;
      }
      return null;
    } catch (error) {
      console.error('Error getting generated code:', error);
      return null;
    }
  }

  // Показать код в консоли (для отладки)
  showCodeForDebugging(): void {
    const code = this.getGeneratedCode();
    if (code) {
      console.log(`\n🎯 ОТЛАДКА: Используйте этот код для тестирования: ${code}\n`);
    }
  }
}

export const mockTelegramBot = MockTelegramBot.getInstance();
