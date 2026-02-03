// Простой тест для проверки функции документов
// Запустить: node test-documents-function.js

import { createClient } from '@supabase/supabase-js';

// Настройки из .env
const supabaseUrl = 'https://eqrzodfukdnwsogjzmoz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcnpvZGZ1a2Rud3NvZ2p6bW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTIyNDcsImV4cCI6MjA4NDU4ODI0N30.H9qXvIFbwcGBlpEWfJjXQ4VV46ykZmrJelMxK-UL_ZY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDocumentsSystem() {
  console.log('🧪 Testing Documents System...\n');

  try {
    // 1. Проверяем существование таблиц
    console.log('1. Checking tables...');
    
    const { data: tables, error: tablesError } = await supabase
      .from('documents')
      .select('count')
      .limit(1);

    if (tablesError) {
      console.error('❌ Documents table not found:', tablesError.message);
      console.log('\n💡 Please run the migration first:');
      console.log('   supabase/migrations/20260201130000_documents_system.sql');
      return;
    }

    console.log('✅ Documents table exists');

    // 2. Проверяем enum типы
    console.log('\n2. Checking document types...');
    
    const { data: types, error: typesError } = await supabase
      .rpc('get_enum_values', { enum_name: 'document_type' })
      .catch(() => ({ data: null, error: { message: 'Function not found' } }));

    if (typesError) {
      console.log('⚠️  Could not check document types (expected if migration not run)');
    } else {
      console.log('✅ Document types available:', types);
    }

    // 3. Проверяем storage bucket
    console.log('\n3. Checking storage bucket...');
    
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets();

    if (bucketsError) {
      console.error('❌ Could not check storage:', bucketsError.message);
    } else {
      const documentsBucket = buckets?.find(b => b.name === 'documents');
      if (documentsBucket) {
        console.log('✅ Documents storage bucket exists');
      } else {
        console.log('⚠️  Documents storage bucket not found');
        console.log('   Create it in Supabase Dashboard > Storage');
      }
    }

    // 4. Тест создания документа
    console.log('\n4. Testing document creation...');
    
    const testDoc = {
      document_type: 'order_confirmation',
      title: 'Test Document',
      description: 'This is a test document',
      created_by: 'test-user-id'
    };

    const { data: newDoc, error: createError } = await supabase
      .from('documents')
      .insert(testDoc)
      .select()
      .single();

    if (createError) {
      console.error('❌ Could not create document:', createError.message);
      
      if (createError.message.includes('column') || createError.message.includes('relation')) {
        console.log('\n💡 Migration may not be complete. Please check:');
        console.log('   1. All tables were created');
        console.log('   2. All enums were created');
        console.log('   3. RLS policies were applied');
      }
    } else {
      console.log('✅ Test document created:', newDoc.document_number);
      
      // 5. Тест удаления тестового документа
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', newDoc.id);

      if (deleteError) {
        console.error('❌ Could not delete test document:', deleteError.message);
      } else {
        console.log('✅ Test document cleaned up');
      }
    }

    console.log('\n🎉 Test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Вывод инструкций
console.log('📋 Documents System Test');
console.log('========================\n');
console.log('This script tests the documents system functionality.\n');
console.log('Prerequisites:');
console.log('1. Run the SQL migration in Supabase Dashboard');
console.log('2. Create storage bucket "documents"');
console.log('3. Deploy the documents-pdf function\n');

testDocumentsSystem();
