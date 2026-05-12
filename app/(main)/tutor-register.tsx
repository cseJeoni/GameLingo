import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert, ScrollView, StyleSheet,
    Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';

// 지원 언어 목록
const LANGUAGES = [
  { code: 'en', label: '영어' },
  { code: 'ja', label: '일본어' },
  { code: 'zh', label: '중국어' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: '스페인어' },
  { code: 'fr', label: '프랑스어' },
];

type Game = { id: string; name: string; slug: string };

export default function TutorRegisterScreen() {
  const [games, setGames] = useState<Game[]>([]);
  const [nativeLanguage, setNativeLanguage] = useState('');
  const [teachingLanguages, setTeachingLanguages] = useState<string[]>([]);
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);

  // 게임 목록 불러오기
  useEffect(() => {
    supabase
      .from('games')
      .select('*')
      .order('name')
      .then(({ data, error }) => {
        if (error) Alert.alert('오류', error.message);
        else setGames(data ?? []);
      });
  }, []);

  // 토글 헬퍼 (배열에 있으면 제거, 없으면 추가)
  function toggle(arr: string[], value: string): string[] {
    return arr.includes(value)
      ? arr.filter(v => v !== value)
      : [...arr, value];
  }

  async function handleSubmit() {
    if (!nativeLanguage) {
      Alert.alert('입력 오류', '모국어를 선택해 주세요.'); return;
    }
    if (teachingLanguages.length === 0) {
      Alert.alert('입력 오류', '가르칠 언어를 1개 이상 선택해 주세요.'); return;
    }
    if (selectedGames.length === 0) {
      Alert.alert('입력 오류', '플레이 가능한 게임을 1개 이상 선택해 주세요.'); return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { Alert.alert('오류', '로그인이 필요합니다.'); setLoading(false); return; }

    const { error } = await supabase
      .from('tutor_profiles')
      .insert({
        user_id: user.id,
        native_language: nativeLanguage,
        teaching_languages: teachingLanguages,
        playable_games: selectedGames,       // slug 배열로 저장
        hourly_rate: parseInt(hourlyRate) || 0,
        bio,
      });

    setLoading(false);

    if (error) {
      // 이미 등록된 경우
      const msg = error.code === '23505'
        ? '이미 튜터로 등록되어 있습니다.'
        : error.message;
      Alert.alert('등록 실패', msg);
      return;
    }

    Alert.alert('등록 완료', '튜터로 등록되었습니다!', [
      { text: '확인', onPress: () => router.replace('/(main)/tutor-list') },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>튜터 등록</Text>

      {/* 모국어 선택 */}
      <Text style={styles.label}>모국어</Text>
      <View style={styles.chipRow}>
        {LANGUAGES.map(lang => (
          <TouchableOpacity
            key={lang.code}
            style={[styles.chip, nativeLanguage === lang.code && styles.chipSelected]}
            onPress={() => setNativeLanguage(lang.code)}
          >
            <Text style={[styles.chipText, nativeLanguage === lang.code && styles.chipTextSelected]}>
              {lang.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 가르칠 언어 선택 (복수) */}
      <Text style={styles.label}>가르칠 언어 (복수 선택 가능)</Text>
      <View style={styles.chipRow}>
        {LANGUAGES.map(lang => (
          <TouchableOpacity
            key={lang.code}
            style={[styles.chip, teachingLanguages.includes(lang.code) && styles.chipSelected]}
            onPress={() => setTeachingLanguages(toggle(teachingLanguages, lang.code))}
          >
            <Text style={[styles.chipText, teachingLanguages.includes(lang.code) && styles.chipTextSelected]}>
              {lang.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 게임 선택 (복수) */}
      <Text style={styles.label}>플레이 가능한 게임 (복수 선택 가능)</Text>
      <View style={styles.chipRow}>
        {games.map(game => (
          <TouchableOpacity
            key={game.slug}
            style={[styles.chip, selectedGames.includes(game.slug) && styles.chipSelected]}
            onPress={() => setSelectedGames(toggle(selectedGames, game.slug))}
          >
            <Text style={[styles.chipText, selectedGames.includes(game.slug) && styles.chipTextSelected]}>
              {game.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 시간당 요금 */}
      <Text style={styles.label}>시간당 요금 (코인)</Text>
      <TextInput
        style={styles.input}
        placeholder="예: 100"
        value={hourlyRate}
        onChangeText={setHourlyRate}
        keyboardType="numeric"
      />

      {/* 소개글 */}
      <Text style={styles.label}>소개글</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="자기 소개를 입력해 주세요"
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={4}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? '등록 중...' : '튜터 등록하기'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingBottom: 60 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8, marginTop: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#FAFAFA',
  },
  chipSelected: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  chipText: { fontSize: 13, color: '#555' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  input: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10,
    padding: 14, fontSize: 15, backgroundColor: '#FAFAFA',
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  button: {
    backgroundColor: '#4F46E5', borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});