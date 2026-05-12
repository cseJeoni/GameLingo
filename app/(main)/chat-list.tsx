import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator, FlatList, StyleSheet,
    Text, TouchableOpacity, View,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';

type ChatRoom = {
  id: string;
  created_at: string;
  counterpartName: string;
  role: 'tutee' | 'tutor';
};

export default function ChatListScreen() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);

  // 화면에 포커스될 때마다 목록 새로고침
  useFocusEffect(
    useCallback(() => {
      fetchRooms();
    }, [])
  );

    async function fetchRooms() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 내 tutor_profile id 먼저 조회
    const { data: myProfile } = await supabase
        .from('tutor_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

    // tutee로 참여한 채팅방 조회
    const { data: tuteeRooms } = await supabase
        .from('chat_rooms')
        .select(`
        id,
        created_at,
        tutor_profiles!chat_rooms_tutor_profile_id_fkey (
            id,
            users ( display_name )
        )
        `)
        .eq('tutee_id', user.id)
        .order('created_at', { ascending: false });

    // 튜터로 참여한 채팅방 조회 (내 tutor_profile이 있을 때만)
    let tutorRooms: any[] = [];
    if (myProfile) {
        const { data } = await supabase
        .from('chat_rooms')
        .select(`
            id,
            created_at,
            tutee:users!chat_rooms_tutee_id_fkey ( display_name )
        `)
        .eq('tutor_profile_id', myProfile.id)
        .order('created_at', { ascending: false });
        tutorRooms = data ?? [];
    }

    // 두 목록을 합쳐서 통합 형식으로 변환
    const combined = [
        ...(tuteeRooms ?? []).map((r: any) => ({
        id: r.id,
        created_at: r.created_at,
        // 튜티 입장: 상대방 = 튜터
        counterpartName: r.tutor_profiles?.users?.display_name ?? '알 수 없음',
        role: 'tutee' as const,
        })),
        ...tutorRooms.map((r: any) => ({
        id: r.id,
        created_at: r.created_at,
        // 튜터 입장: 상대방 = 튜티
        counterpartName: r.tutee?.display_name ?? '알 수 없음',
        role: 'tutor' as const,
        })),
    ].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setRooms(combined);
    setLoading(false);
    }

    function renderRoom({ item }: { item: ChatRoom }) {
    return (
        <TouchableOpacity
        style={styles.roomCard}
        onPress={() => router.push({
            pathname: '/(main)/chat-room',
            params: { roomId: item.id, tutorName: item.counterpartName },
        })}
        >
        <View style={styles.avatar}>
            <Text style={styles.avatarText}>
            {item.counterpartName[0]?.toUpperCase() ?? '?'}
            </Text>
        </View>
        <View style={styles.roomInfo}>
            <Text style={styles.roomName}>{item.counterpartName}</Text>
            <Text style={styles.roomSub}>
            {item.role === 'tutee' ? '내가 수강 중' : '내가 튜터'}
            </Text>
        </View>
        </TouchableOpacity>
    );
    }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>채팅 목록</Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#4F46E5" />
      ) : rooms.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>아직 채팅방이 없어요</Text>
          <Text style={styles.emptySubText}>튜터 찾기에서 채팅을 시작해보세요</Text>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={item => item.id}
          renderItem={renderRoom}
          contentContainerStyle={{ padding: 16, gap: 8 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', padding: 16, paddingBottom: 8 },
  roomCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#EFEFEF',
    backgroundColor: '#fff',
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  roomInfo: { flex: 1 },
  roomName: { fontSize: 15, fontWeight: '600' },
  roomSub: { fontSize: 13, color: '#aaa', marginTop: 2 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#888' },
  emptySubText: { fontSize: 13, color: '#bbb' },
});