import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ZegoExpressEngine, {
  ZegoScenario,
  ZegoUpdateType,
} from 'zego-express-engine-reactnative';

const APP_ID = 368449960;
const APP_SIGN =
  '096f7a85dceb99958755f8410bd0c12a206e0b3a8b06b6120b0c6fa2c58d56a5';
const ROOM_ID = 'gamelingo-test-room-001';

type RemoteUser = { streamID: string; userName: string; userID: string };

export default function VoiceChatScreen() {
  const [userID, setUserID] = useState('');
  const [userName, setUserName] = useState('');
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const engineCreated = useRef(false);

  useEffect(() => {
    return () => {
      if (engineCreated.current) {
        ZegoExpressEngine.destroyEngine();
        engineCreated.current = false;
      }
    };
  }, []);

  async function ensureMicPermission() {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: '마이크 권한',
        message: '음성 채팅을 위해 마이크 사용 권한이 필요합니다.',
        buttonPositive: '허용',
        buttonNegative: '거부',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  async function joinRoom() {
    if (!userID.trim() || !userName.trim()) {
      Alert.alert('입력 필요', 'User ID와 닉네임을 모두 입력해 주세요.');
      return;
    }

    const ok = await ensureMicPermission();
    if (!ok) {
      Alert.alert('권한 거부', '마이크 권한이 없으면 음성 통화를 할 수 없어요.');
      return;
    }

    try {
      if (!engineCreated.current) {
        await ZegoExpressEngine.createEngineWithProfile({
          appID: APP_ID,
          appSign: APP_SIGN,
          scenario: ZegoScenario.HighQualityChatroom,
        });
        engineCreated.current = true;
      }

      const engine = ZegoExpressEngine.instance();

      engine.on(
        'roomStreamUpdate',
        (_roomID: string, updateType: ZegoUpdateType, streamList: any[]) => {
          if (updateType === ZegoUpdateType.Add) {
            streamList.forEach((s) => {
              engine.startPlayingStream(s.streamID);
              setRemoteUsers((prev) => [
                ...prev,
                {
                  streamID: s.streamID,
                  userID: s.user.userID,
                  userName: s.user.userName,
                },
              ]);
            });
          } else {
            streamList.forEach((s) => {
              engine.stopPlayingStream(s.streamID);
              setRemoteUsers((prev) =>
                prev.filter((u) => u.streamID !== s.streamID),
              );
            });
          }
        },
      );

      engine.on('roomStateUpdate', (_roomID: string, state: number) => {
        console.log('[Zego] roomStateUpdate', state);
      });

      await engine.loginRoom(ROOM_ID, { userID: userID.trim(), userName: userName.trim() });

      const streamID = `stream-${userID.trim()}`;
      await engine.startPublishingStream(streamID);

      setJoined(true);
    } catch (e: any) {
      Alert.alert('입장 실패', String(e?.message ?? e));
    }
  }

  async function leaveRoom() {
    try {
      const engine = ZegoExpressEngine.instance();
      await engine.stopPublishingStream();
      await engine.logoutRoom(ROOM_ID);
    } catch (e) {
      console.warn('[Zego] leaveRoom error', e);
    } finally {
      ZegoExpressEngine.destroyEngine();
      engineCreated.current = false;
      setJoined(false);
      setMuted(false);
      setRemoteUsers([]);
    }
  }

  function toggleMute() {
    const engine = ZegoExpressEngine.instance();
    const next = !muted;
    engine.muteMicrophone(next);
    setMuted(next);
  }

  if (!joined) {
    return (
      <View style={styles.formContainer}>
        <Text style={styles.title}>GameLingo Voice Chat</Text>
        <Text style={styles.label}>User ID (기기마다 다르게 입력)</Text>
        <TextInput
          style={styles.input}
          placeholder="예: user001"
          autoCapitalize="none"
          value={userID}
          onChangeText={setUserID}
        />
        <Text style={styles.label}>닉네임</Text>
        <TextInput
          style={styles.input}
          placeholder="예: Alice"
          value={userName}
          onChangeText={setUserName}
        />
        <View style={styles.buttonRow}>
          <Button title="음성방 입장" onPress={joinRoom} />
        </View>
        <Text style={styles.hint}>
          Room ID: {ROOM_ID}
          {'\n'}두 기기에서 같은 Room ID로 입장하세요.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.roomContainer}>
      <Text style={styles.title}>음성방 입장 완료</Text>
      <Text style={styles.label}>방: {ROOM_ID}</Text>
      <Text style={styles.label}>나: {userName} ({userID})</Text>

      <Text style={styles.sectionTitle}>참가자 ({remoteUsers.length + 1}명)</Text>
      <Text style={styles.userLine}>• {userName} (나) {muted ? '🔇' : '🎤'}</Text>
      {remoteUsers.map((u) => (
        <Text key={u.streamID} style={styles.userLine}>• {u.userName}</Text>
      ))}

      <View style={styles.buttonRow}>
        <Button
          title={muted ? '음소거 해제' : '내 마이크 음소거'}
          onPress={toggleMute}
        />
      </View>
      <View style={styles.buttonRow}>
        <Button title="방 나가기" color="#c0392b" onPress={leaveRoom} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  roomContainer: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    marginTop: 12,
    marginBottom: 4,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  buttonRow: {
    marginTop: 16,
  },
  userLine: {
    fontSize: 15,
    paddingVertical: 4,
  },
  hint: {
    marginTop: 24,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
