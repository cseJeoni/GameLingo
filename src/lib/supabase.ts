import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yiidgolgmzuwgjseqtmu.supabase.co';   // 본인 값으로
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaWRnb2xnbXp1d2dqc2VxdG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjEwNzIsImV4cCI6MjA5Mzk5NzA3Mn0.TWGNnjyC3Lrt25jpLxRW3yEz3m7bagZCVWGtAYZBxE4'; // 본인 값으로

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,         // SecureStore → AsyncStorage로 교체
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,     // React Native에서는 반드시 false
  },
});