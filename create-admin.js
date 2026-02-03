// Скрипт для создания администратора в Firebase
// Запустить: node create-admin.js

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';

// Firebase конфигурация
const firebaseConfig = {
  apiKey: "AIzaSyBuht58TZusVJm4do47LSooBWBGSZErsS8",
  authDomain: "asialog-2aa38.firebaseapp.com",
  projectId: "asialog-2aa38",
  storageBucket: "asialog-2aa38.firebasestorage.app",
  messagingSenderId: "472239170057",
  appId: "1:472239170057:web:c5267f425f2ab661520ed8",
  measurementId: "G-VZWR0QP89W"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function createAdmin() {
  const adminEmail = 'admin@swiftship.uz';
  const adminPassword = 'admin123456';

  try {
    console.log('🔥 Создание администратора...');
    console.log('📧 Email:', adminEmail);
    
    // Пытаемся создать пользователя
    const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
    const user = userCredential.user;
    
    console.log('✅ Администратор успешно создан!');
    console.log('👤 UID:', user.uid);
    console.log('📧 Email:', user.email);
    console.log('🔐 Пароль:', adminPassword);
    
    console.log('\n🎉 Теперь можете войти в админку:');
    console.log('🌐 http://localhost:8081/admin');
    console.log('📧 Email:', adminEmail);
    console.log('🔐 Пароль:', adminPassword);
    
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('⚠️ Пользователь уже существует. Пробуем войти...');
      
      try {
        const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
        console.log('✅ Вход успешен! Пользователь существует.');
        console.log('👤 UID:', userCredential.user.uid);
        console.log('\n🎉 Используйте эти данные для входа:');
        console.log('📧 Email:', adminEmail);
        console.log('🔐 Пароль:', adminPassword);
      } catch (signInError) {
        console.log('❌ Ошибка входа:', signInError.message);
        console.log('\n💡 Возможные решения:');
        console.log('1. Пользователь существует но с другим паролем');
        console.log('2. Попробуйте сбросить пароль в Firebase Console');
        console.log('3. Создайте нового пользователя с другим email');
      }
    } else {
      console.log('❌ Ошибка создания пользователя:', error.message);
    }
  }
}

// Запуск
createAdmin();
