import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, FlatList, StyleSheet,
    Text, TouchableOpacity, View,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';



const LANGUAGES = [
  { code: '', label: '전체' },
  { code: 'en', label: '영어' },
  { code: 'ja', label: '일본어' },
  { code: 'zh', label: '중국어' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: '스페인어' },
  { code: 'fr', label: '프랑스어' },
];

type Tutor = {
  id: string;
  native_language: string;
  teaching_languages: string[];
  playable_games: string[];
  hourly_rate: number;
  bio: string;
  rating: number;
  users: { id: string; display_name: string; avatar_url: string | null };
};

export default function TutorListScreen() {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('');

  useEffect(() => {
    fetchTutors();
  }, [selectedLanguage]);

async function fetchTutors() {
  setLoading(true);

  // users 테이블 기준으로 tutor_profiles를 JOIN하는 방향으로 변경
  let query = supabase
    .from('users')
    .select(`
      id,
      display_name,
      avatar_url,
      tutor_profiles!tutor_profiles_user_id_fkey (
        id,
        native_language,
        teaching_languages,
        playable_games,
        hourly_rate,
        bio,
        rating,
        is_active
      )
    `)
    .not('tutor_profiles', 'is', null);

  const { data, error } = await query;

  if (error) {
    console.error(error);
    setLoading(false);
    return;
  }

  // users 기준으로 가져온 데이터를 Tutor 타입 형태로 변환
  const tutorList: Tutor[] = (data ?? [])
    .filter((u: any) => {
      const tp = Array.isArray(u.tutor_profiles)
        ? u.tutor_profiles[0]
        : u.tutor_profiles;
      return tp && tp.is_active;
    })
    .map((u: any) => {
      const tp = Array.isArray(u.tutor_profiles)
        ? u.tutor_profiles[0]
        : u.tutor_profiles;
      return {
        id: tp.id,
        native_language: tp.native_language,
        teaching_languages: tp.teaching_languages,
        playable_games: tp.playable_games,
        hourly_rate: tp.hourly_rate,
        bio: tp.bio,
        rating: tp.rating,
        users: {
          id: u.id,
          display_name: u.display_name,
          avatar_url: u.avatar_url,
        },
      };
    });

  // 언어 필터 (클라이언트 측)
  const filtered = selectedLanguage
    ? tutorList.filter(t => t.teaching_languages.includes(selectedLanguage))
    : tutorList;

  // rating 내림차순 정렬
  filtered.sort((a, b) => b.rating - a.rating);

  setTutors(filtered);
  setLoading(false);
}

    async function handleStartChat(tutor: Tutor) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { Alert.alert('오류', '로그인이 필요합니다.'); return; }

    console.log('[CHAT] 현재 유저:', user.id);
    console.log('[CHAT] 튜터 프로필 ID:', tutor.id);
    console.log('[CHAT] 튜터 유저 ID:', tutor.users?.id);

    if (user.id === tutor.users?.id) {
        Alert.alert('알림', '본인의 튜터 프로필입니다.');
        return;
    }

    // 기존 채팅방 조회
    const { data: existing, error: selectError } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('tutee_id', user.id)
        .eq('tutor_profile_id', tutor.id)
        .maybeSingle(); // .single() 대신 .maybeSingle() 사용 (없어도 에러 안 남)

    console.log('[CHAT] 기존 채팅방 조회 결과:', existing, '에러:', selectError);

    if (existing) {
        router.push({
        pathname: '/(main)/chat-room',
        params: { roomId: existing.id, tutorName: tutor.users?.display_name ?? '' },
        });
        return;
    }

    // 새 채팅방 생성
    const { data: newRoom, error: insertError } = await supabase
        .from('chat_rooms')
        .insert({ tutee_id: user.id, tutor_profile_id: tutor.id })
        .select('id')
        .single();

    console.log('[CHAT] 채팅방 생성 결과:', newRoom, '에러:', insertError);

    if (insertError) { Alert.alert('오류', insertError.message); return; }

    router.push({
        pathname: '/(main)/chat-room',
        params: { roomId: newRoom.id, tutorName: tutor.users?.display_name ?? '' },
    });
    }

  function getLanguageLabel(code: string) {
    return LANGUAGES.find(l => l.code === code)?.label ?? code;
  }

  function renderTutor({ item }: { item: Tutor }) {
    return (
      <TouchableOpacity style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.users?.display_name?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.name}>{item.users?.display_name ?? '이름 없음'}</Text>
            <Text style={styles.sub}>
              모국어: {getLanguageLabel(item.native_language)}
            </Text>
            <Text style={styles.sub}>
              가르치는 언어: {item.teaching_languages.map(getLanguageLabel).join(', ')}
            </Text>
          </View>
          <View style={styles.rateBox}>
            <Text style={styles.rate}>{item.hourly_rate}</Text>
            <Text style={styles.rateSub}>코인/시간</Text>
          </View>
        </View>

        {item.bio ? (
          <Text style={styles.bio} numberOfLines={2}>{item.bio}</Text>
        ) : null}

        <View style={styles.gameRow}>
          {item.playable_games.map(slug => (
            <View key={slug} style={styles.gameChip}>
              <Text style={styles.gameChipText}>{slug}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
        style={styles.chatButton}
        onPress={() => handleStartChat(item)}
        >
        <Text style={styles.chatButtonText}>💬 채팅 시작</Text>
        </TouchableOpacity>

      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>튜터 찾기</Text>

      {/* 언어 필터 */}
      <FlatList
        horizontal
        data={LANGUAGES}
        keyExtractor={item => item.code}
        showsHorizontalScrollIndicator={false}
        style={styles.filterList}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, selectedLanguage === item.code && styles.filterChipSelected]}
            onPress={() => setSelectedLanguage(item.code)}
          >
            <Text style={[styles.filterText, selectedLanguage === item.code && styles.filterTextSelected]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* 튜터 목록 */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#4F46E5" />
      ) : tutors.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>조건에 맞는 튜터가 없어요</Text>
        </View>
      ) : (
        <FlatList
          data={tutors}
          keyExtractor={item => item.id}
          renderItem={renderTutor}
          contentContainerStyle={{ padding: 16, gap: 12 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', padding: 16, paddingBottom: 8 },
  filterList: { maxHeight: 48, marginBottom: 4 },
  filterChip: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 7, backgroundColor: '#FAFAFA',
  },
  filterChipSelected: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  filterText: { fontSize: 13, color: '#555' },
  filterTextSelected: { color: '#fff', fontWeight: '600' },
  card: {
    borderWidth: 1, borderColor: '#EFEFEF', borderRadius: 12,
    padding: 16, backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  cardInfo: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  sub: { fontSize: 12, color: '#888', marginBottom: 1 },
  rateBox: { alignItems: 'center' },
  rate: { fontSize: 16, fontWeight: '700', color: '#4F46E5' },
  rateSub: { fontSize: 11, color: '#aaa' },
  bio: { fontSize: 13, color: '#666', marginTop: 10, lineHeight: 18 },
  gameRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  gameChip: {
    backgroundColor: '#F3F4F6', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  gameChipText: { fontSize: 11, color: '#555' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#aaa' },
  chatButton: {
  marginTop: 12, backgroundColor: '#EEF2FF',
  borderRadius: 8, padding: 10, alignItems: 'center',
},
chatButtonText: { color: '#4F46E5', fontWeight: '600', fontSize: 14 },
});