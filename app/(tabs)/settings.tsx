import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Settings as SettingsIcon, Volume2, VolumeX, Zap, ZapOff } from 'lucide-react-native';

export default function SettingsTab() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSound = await AsyncStorage.getItem('soundEnabled');
      const savedHaptic = await AsyncStorage.getItem('hapticEnabled');
      const savedDifficulty = await AsyncStorage.getItem('difficulty');
      
      if (savedSound !== null) {
        setSoundEnabled(JSON.parse(savedSound));
      }
      if (savedHaptic !== null) {
        setHapticEnabled(JSON.parse(savedHaptic));
      }
      if (savedDifficulty) {
        setDifficulty(savedDifficulty as 'easy' | 'normal' | 'hard');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSetting = async (key: string, value: any) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving setting:', error);
    }
  };

  const toggleSound = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    saveSetting('soundEnabled', newValue);
  };

  const toggleHaptic = () => {
    const newValue = !hapticEnabled;
    setHapticEnabled(newValue);
    saveSetting('hapticEnabled', newValue);
  };

  const changeDifficulty = (newDifficulty: 'easy' | 'normal' | 'hard') => {
    setDifficulty(newDifficulty);
    AsyncStorage.setItem('difficulty', newDifficulty);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <SettingsIcon size={32} color="#6200EE" />
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Audio & Feedback</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            {soundEnabled ? (
              <Volume2 size={24} color="#6200EE" />
            ) : (
              <VolumeX size={24} color="#666" />
            )}
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Sound Effects</Text>
              <Text style={styles.settingDescription}>Play sounds during gameplay</Text>
            </View>
          </View>
          <Switch
            value={soundEnabled}
            onValueChange={toggleSound}
            trackColor={{ false: '#333', true: '#6200EE' }}
            thumbColor={soundEnabled ? '#fff' : '#666'}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            {hapticEnabled ? (
              <Zap size={24} color="#6200EE" />
            ) : (
              <ZapOff size={24} color="#666" />
            )}
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Haptic Feedback</Text>
              <Text style={styles.settingDescription}>Vibrate on collisions</Text>
            </View>
          </View>
          <Switch
            value={hapticEnabled}
            onValueChange={toggleHaptic}
            trackColor={{ false: '#333', true: '#6200EE' }}
            thumbColor={hapticEnabled ? '#fff' : '#666'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Difficulty</Text>
        
        <View style={styles.difficultyContainer}>
          {(['easy', 'normal', 'hard'] as const).map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.difficultyButton,
                difficulty === level && styles.difficultyButtonActive
              ]}
              onPress={() => changeDifficulty(level)}
            >
              <Text style={[
                styles.difficultyText,
                difficulty === level && styles.difficultyTextActive
              ]}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <Text style={styles.difficultyDescription}>
          {difficulty === 'easy' && 'Slower ball speed, larger paddle'}
          {difficulty === 'normal' && 'Balanced gameplay experience'}
          {difficulty === 'hard' && 'Faster ball speed, smaller paddle'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>Brick Breaker</Text>
          <Text style={styles.aboutVersion}>Version 1.0.0</Text>
          <Text style={styles.aboutDescription}>
            A modern take on the classic brick breaker game. Break all the bricks to advance through rounds and achieve the highest score possible!
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  contentContainer: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    gap: 12,
  },
  title: {
    fontSize: 32,
    color: '#fff',
    fontFamily: 'Inter-Bold',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    color: '#fff',
    fontFamily: 'Inter-Bold',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: '#fff',
    fontFamily: 'Inter-Bold',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'Inter-Regular',
  },
  difficultyContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  difficultyButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  difficultyButtonActive: {
    backgroundColor: '#6200EE',
    borderColor: '#6200EE',
  },
  difficultyText: {
    fontSize: 16,
    color: '#888',
    fontFamily: 'Inter-Bold',
  },
  difficultyTextActive: {
    color: '#fff',
  },
  difficultyDescription: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  aboutCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
  },
  aboutTitle: {
    fontSize: 20,
    color: '#fff',
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  aboutVersion: {
    fontSize: 14,
    color: '#6200EE',
    fontFamily: 'Inter-Regular',
    marginBottom: 12,
  },
  aboutDescription: {
    fontSize: 14,
    color: '#ccc',
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
});