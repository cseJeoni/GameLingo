import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/lib/supabase';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎮 Game Lingo</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/(main)/tutor-list')}
      >
        <Text style={styles.buttonText}>튜터 찾기</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonSecondary]}
        onPress={() => router.push('/(main)/tutor-register')}
      >
        <Text style={styles.buttonText}>튜터 등록하기</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#059669' }]}
        onPress={() => router.push('/(main)/chat-list')}
      >
        <Text style={styles.buttonText}>채팅 목록</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonDanger]}
        onPress={() => supabase.auth.signOut()}
      >
        <Text style={styles.buttonText}>로그아웃</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', gap: 12 },
  title: { fontSize: 32, fontWeight: '700', marginBottom: 24 },
  button: {
    backgroundColor: '#4F46E5', borderRadius: 10,
    paddingVertical: 14, paddingHorizontal: 40, width: 220, alignItems: 'center',
  },
  buttonSecondary: { backgroundColor: '#7C3AED' },
  buttonDanger: { backgroundColor: '#EF4444', marginTop: 12 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});