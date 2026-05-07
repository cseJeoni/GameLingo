import React, { useState } from 'react';
import {
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ZegoUIKitPrebuiltLiveAudioRoom, {
  AUDIENCE_DEFAULT_CONFIG,
  HOST_DEFAULT_CONFIG,
} from '@zegocloud/zego-uikit-prebuilt-live-audio-room-rn';

const APP_ID = 368449960;
const APP_SIGN =
  '096f7a85dceb99958755f8410bd0c12a206e0b3a8b06b6120b0c6fa2c58d56a5';
const ROOM_ID = 'gamelingo-test-room-001';

type Role = 'host' | 'audience' | null;

export default function VoiceChatScreen() {
  const [userID, setUserID] = useState('');
  const [userName, setUserName] = useState('');
  const [role, setRole] = useState<Role>(null);

  if (role === null) {
    return (
      <View style={styles.formContainer}>
        <Text style={styles.title}>GameLingo Voice Chat</Text>
        <Text style={styles.label}>User ID (숫자 또는 영문, 기기마다 다르게)</Text>
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
          <Button
            title="방장(Host)으로 입장"
            onPress={() => {
              if (userID && userName) setRole('host');
            }}
          />
        </View>
        <View style={styles.buttonRow}>
          <Button
            title="청중(Audience)으로 입장"
            onPress={() => {
              if (userID && userName) setRole('audience');
            }}
          />
        </View>
        <Text style={styles.hint}>
          Room ID: {ROOM_ID}
          {'\n'}두 기기에서 같은 Room ID로 접속하세요.
        </Text>
      </View>
    );
  }

  const baseConfig = role === 'host' ? HOST_DEFAULT_CONFIG : AUDIENCE_DEFAULT_CONFIG;

  return (
    <View style={styles.roomContainer}>
      <ZegoUIKitPrebuiltLiveAudioRoom
        appID={APP_ID}
        appSign={APP_SIGN}
        userID={userID}
        userName={userName}
        roomID={ROOM_ID}
        config={{
          ...baseConfig,
          onLeaveLiveAudioRoom: () => {
            setRole(null);
          },
        }}
      />
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
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
  hint: {
    marginTop: 24,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
