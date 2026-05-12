import { RealtimeChannel } from '@supabase/supabase-js';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert, FlatList, KeyboardAvoidingView, PermissionsAndroid,
    Platform, StyleSheet, Text, TextInput,
    TouchableOpacity, View,
} from 'react-native';
import ZegoExpressEngine, {
    ZegoScenario,
} from 'zego-express-engine-reactnative';
import { supabase } from '../../src/lib/supabase';

// ⚠️ 본인 ZegoCloud AppID와 AppSign으로 교체하세요
const ZEGO_APP_ID = 368449960;        // 숫자형 AppID
const ZEGO_APP_SIGN = '096f7a85dceb99958755f8410bd0c12a206e0b3a8b06b6120b0c6fa2c58d56a5';     // 문자열 AppSign

type Message = {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
};

type CallStatus = 'idle' | 'calling' | 'in_call';

export default function ChatRoomScreen() {
  const { roomId, tutorName } = useLocalSearchParams<{
    roomId: string;
    tutorName: string;
  }>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [isTutor, setIsTutor] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callerId, setCallerId] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);      // 채팅용
  const callChannelRef = useRef<RealtimeChannel | null>(null);  // 통화 상태용
  const currentUserIdRef = useRef('');  
  const zegoInitialized = useRef(false);
  

useEffect(() => {
  let mounted = true;

  initUser();
  fetchMessages();
  setupRealtimeChannel();

  return () => {
    mounted = false;
    // 채널 완전 제거
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (callChannelRef.current) {
      supabase.removeChannel(callChannelRef.current);
      callChannelRef.current = null;
    }
    leaveZegoRoom();
    if (zegoInitialized.current) {
      ZegoExpressEngine.destroyEngine();
      zegoInitialized.current = false;
    }
  };
}, [roomId]);

  async function initUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);
    currentUserIdRef.current = user.id;

    // 내가 이 채팅방의 튜터인지 확인
    const { data: room } = await supabase
      .from('chat_rooms')
      .select('tutor_profiles!chat_rooms_tutor_profile_id_fkey(user_id)')
      .eq('id', roomId)
      .single();

    const tutorUserId = (room?.tutor_profiles as any)?.user_id;
    setIsTutor(tutorUserId === user.id);
  }

    function setupRealtimeChannel() {
    // 채널 1 — 채팅 메시지 브로드캐스트 전용
    const chatChannel = supabase
        .channel(`chat:${roomId}`, {
        config: { broadcast: { self: false } },
        })
        .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        setMessages(prev => [...prev, payload as Message]);
        setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
        })
        .subscribe();                          // ← 마지막에 subscribe

    channelRef.current = chatChannel;

    // 채널 2 — 통화 상태 변화 감지 전용
    const callChannel = supabase
        .channel(`call:${roomId}`)
        .on(
        'postgres_changes',
        {
            event: 'UPDATE',
            schema: 'public',
            table: 'chat_rooms',
            filter: `id=eq.${roomId}`,
        },
        (payload) => {
            const newStatus = payload.new.call_status as CallStatus;
            const newCallerId = payload.new.caller_id as string;
            console.log('[CALL STATUS CHANGED]', newStatus, newCallerId);
            setCallStatus(newStatus);
            setCallerId(newCallerId);

            if (newStatus === 'in_call') {
            joinZegoRoom(newCallerId);
            } else if (newStatus === 'idle') {
            leaveZegoRoom();
            }
        }
        )
        .subscribe((status) => {             // ← 마지막에 subscribe
        console.log('[CALL CHANNEL STATUS]', status);
        });

    callChannelRef.current = callChannel;
    }

  async function fetchMessages() {
    const { data, error } = await supabase
      .from('messages')
      .select('id, content, sender_id, created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) { console.error(error); return; }
    setMessages(data ?? []);
    setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
  }

  // ─── ZegoCloud 함수들 ───────────────────────────────────────

  async function requestMicPermission() {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: '마이크 권한 요청',
        message: '음성 통화를 위해 마이크 권한이 필요합니다.',
        buttonPositive: '허용',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  async function initZego() {
    if (zegoInitialized.current) return;
    const engine = await ZegoExpressEngine.createEngineWithProfile({
      appID: ZEGO_APP_ID,
      appSign: ZEGO_APP_SIGN,
      scenario: ZegoScenario.StandardVoiceCall,
    });
    zegoInitialized.current = true;
    return engine;
  }

async function joinZegoRoom(incomingCallerId: string) {
  const myId = currentUserIdRef.current;   // ← state 대신 ref에서 읽기
  console.log('[ZEGO] joinZegoRoom 호출, callerId:', incomingCallerId, 'myId:', myId);

  if (!myId) {
    console.error('[ZEGO] currentUserId가 없음, 중단');
    return;
  }

  const hasPerm = await requestMicPermission();
  console.log('[ZEGO] 마이크 권한:', hasPerm);
  if (!hasPerm) {
    Alert.alert('권한 필요', '마이크 권한이 없어 통화할 수 없습니다.');
    return;
  }

  try {
    await initZego();
    console.log('[ZEGO] 엔진 초기화 완료');

    const zegoRoomId = `call_${roomId}`;
    const zegoUser = { userID: myId, userName: myId };
    console.log('[ZEGO] 방 입장 시도:', zegoRoomId, zegoUser);

    await ZegoExpressEngine.instance().loginRoom(
      zegoRoomId,
      zegoUser,
      { isUserStatusNotify: true }
    );
    console.log('[ZEGO] 방 입장 완료');

    const myStreamId = `stream_${myId}`;
    await ZegoExpressEngine.instance().startPublishingStream(myStreamId);
    console.log('[ZEGO] 스트림 발행 시작:', myStreamId);

    ZegoExpressEngine.instance().on(
      'roomStreamUpdate',
      async (zegoRoomID, updateType, streamList) => {
    console.log('[ZEGO] 스트림 업데이트:', updateType, streamList);

    // updateType: 0 = ADD, 1 = DELETE (숫자로 옴)
    const isAdd = updateType === 0 || updateType === 'ADD';

    if (isAdd && streamList.length > 0) {
      for (const stream of streamList) {
        // 본인 스트림은 수신 안 함
        if (stream.streamID === `stream_${currentUserIdRef.current}`) continue;
        console.log('[ZEGO] 상대방 스트림 수신 시작:', stream.streamID);
        await ZegoExpressEngine.instance().startPlayingStream(stream.streamID);
      }
    }
  }
);

  } catch (e) {
    console.error('[ZEGO] 오류:', e);
  }
}

  async function leaveZegoRoom() {
    if (!zegoInitialized.current) return;
    await ZegoExpressEngine.instance().stopPublishingStream();
    await ZegoExpressEngine.instance().logoutRoom(`call_${roomId}`);
  }

    async function cleanup() {
    if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
    }
    if (callChannelRef.current) {
        supabase.removeChannel(callChannelRef.current);
    }
    await leaveZegoRoom();
    if (zegoInitialized.current) {
        ZegoExpressEngine.destroyEngine();
        zegoInitialized.current = false;
    }
    }

  // ─── 통화 제어 함수들 ────────────────────────────────────────

  // 튜터: 전화 걸기
    async function handleStartCall() {
    console.log('[CALL] 통화 시작 시도, roomId:', roomId);
    console.log('[CALL] currentUserId:', currentUserId);

    const { data, error } = await supabase
        .from('chat_rooms')
        .update({ call_status: 'calling', caller_id: currentUserId })
        .eq('id', roomId)
        .select();

    console.log('[CALL] 업데이트 결과:', data, '에러:', error);
    }

  // 튜티: 수락
  async function handleAcceptCall() {
    await supabase
      .from('chat_rooms')
      .update({ call_status: 'in_call' })
      .eq('id', roomId);
    // in_call 상태가 되면 setupRealtimeChannel의 postgres_changes가
    // 양쪽 모두에게 감지되어 joinZegoRoom() 자동 호출됨
  }

  // 튜티: 거절
  async function handleRejectCall() {
    await supabase
      .from('chat_rooms')
      .update({ call_status: 'idle', caller_id: null })
      .eq('id', roomId);
  }

  // 양쪽 모두: 통화 종료
  async function handleEndCall() {
    await supabase
      .from('chat_rooms')
      .update({ call_status: 'idle', caller_id: null })
      .eq('id', roomId);
  }

  // ─── 채팅 함수 ───────────────────────────────────────────────

  async function handleSend() {
    const text = inputText.trim();
    if (!text || !currentUserId) return;
    setInputText('');

    const { data, error } = await supabase
      .from('messages')
      .insert({ room_id: roomId, sender_id: currentUserId, content: text })
      .select('id, content, sender_id, created_at')
      .single();

    if (error) { Alert.alert('전송 실패', error.message); return; }

    setMessages(prev => [...prev, data]);
    setTimeout(() => flatListRef.current?.scrollToEnd(), 100);

    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'new_message',
        payload: data,
      });
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  function renderMessage({ item }: { item: Message }) {
    const isMe = item.sender_id === currentUserId;
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>
            {item.content}
          </Text>
        </View>
        <Text style={styles.msgTime}>{formatTime(item.created_at)}</Text>
      </View>
    );
  }

  // ─── 통화 상태별 UI ──────────────────────────────────────────

  function renderCallBar() {
    // 통화 중
    if (callStatus === 'in_call') {
      return (
        <View style={styles.callBar}>
          <View style={styles.callIndicator} />
          <Text style={styles.callBarText}>통화 중</Text>
          <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall}>
            <Text style={styles.endCallText}>📵 종료</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // 튜터: 발신 중
    if (callStatus === 'calling' && isTutor) {
      return (
        <View style={[styles.callBar, styles.callBarCalling]}>
          <Text style={styles.callBarText}>📞 연결 중...</Text>
          <TouchableOpacity style={styles.endCallBtn} onPress={handleRejectCall}>
            <Text style={styles.endCallText}>취소</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // 튜티: 수신 중
    if (callStatus === 'calling' && !isTutor) {
      return (
        <View style={[styles.callBar, styles.callBarIncoming]}>
          <Text style={styles.callBarText}>📲 튜터가 전화를 걸었어요</Text>
          <View style={styles.callActions}>
            <TouchableOpacity style={styles.acceptBtn} onPress={handleAcceptCall}>
              <Text style={styles.acceptText}>수락</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectBtn} onPress={handleRejectCall}>
              <Text style={styles.rejectText}>거절</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // idle: 튜터에게만 전화 걸기 버튼 표시
    if (callStatus === 'idle' && isTutor) {
      return (
        <TouchableOpacity style={styles.startCallBtn} onPress={handleStartCall}>
          <Text style={styles.startCallText}>📞 음성 통화 시작</Text>
        </TouchableOpacity>
      );
    }

    return null;
  }

  // ─── 렌더 ────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{tutorName ?? '채팅'}</Text>
      </View>

      {/* 통화 상태 바 */}
      {renderCallBar()}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="메시지를 입력하세요"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendButtonText}>전송</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    padding: 16, paddingTop: 52,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#EFEFEF',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  messageList: { padding: 16, gap: 8, flexGrow: 1 },
  msgRow: { flexDirection: 'column', marginBottom: 4 },
  msgRowMe: { alignItems: 'flex-end' },
  msgRowOther: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
  },
  bubbleMe: { backgroundColor: '#4F46E5', borderBottomRightRadius: 4 },
  bubbleOther: {
    backgroundColor: '#fff', borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: '#EFEFEF',
  },
  msgText: { fontSize: 15, color: '#222', lineHeight: 20 },
  msgTextMe: { color: '#fff' },
  msgTime: { fontSize: 11, color: '#bbb', marginTop: 3, marginHorizontal: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 12, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#EFEFEF',
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#E0E0E0',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, maxHeight: 100, backgroundColor: '#FAFAFA',
  },
  sendButton: {
    backgroundColor: '#4F46E5', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  // 통화 관련 스타일
  startCallBtn: {
    margin: 12, backgroundColor: '#ECFDF5', borderRadius: 10,
    padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#6EE7B7',
  },
  startCallText: { color: '#059669', fontWeight: '600', fontSize: 14 },
  callBar: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, backgroundColor: '#1E1B4B',
    justifyContent: 'space-between',
  },
  callBarCalling: { backgroundColor: '#78350F' },
  callBarIncoming: { backgroundColor: '#064E3B', flexDirection: 'column', gap: 8 },
  callIndicator: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#34D399', marginRight: 8,
  },
  callBarText: { color: '#fff', fontWeight: '600', fontSize: 14, flex: 1 },
  callActions: { flexDirection: 'row', gap: 8, width: '100%' },
  acceptBtn: {
    flex: 1, backgroundColor: '#059669',
    borderRadius: 8, padding: 10, alignItems: 'center',
  },
  acceptText: { color: '#fff', fontWeight: '700' },
  rejectBtn: {
    flex: 1, backgroundColor: '#DC2626',
    borderRadius: 8, padding: 10, alignItems: 'center',
  },
  rejectText: { color: '#fff', fontWeight: '700' },
  endCallBtn: {
    backgroundColor: '#DC2626', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  endCallText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});