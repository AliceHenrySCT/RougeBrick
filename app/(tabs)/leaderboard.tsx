import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trophy, RotateCcw } from 'lucide-react-native';

interface ScoreEntry {
  score: number;
  round: number;
  date: string;
}

export default function LeaderboardTab() {
  const [highScore, setHighScore] = useState(0);
  const [recentScores, setRecentScores] = useState<ScoreEntry[]>([]);

  useEffect(() => {
    loadScores();
  }, []);

  const loadScores = async () => {
    try {
      const savedHighScore = await AsyncStorage.getItem('highScore');
      const savedRecentScores = await AsyncStorage.getItem('recentScores');
      
      if (savedHighScore) {
        setHighScore(parseInt(savedHighScore));
      }
      
      if (savedRecentScores) {
        setRecentScores(JSON.parse(savedRecentScores));
      }
    } catch (error) {
      console.error('Error loading scores:', error);
    }
  };

  const resetScores = () => {
    Alert.alert(
      'Reset Scores',
      'Are you sure you want to reset all scores? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('highScore');
              await AsyncStorage.removeItem('recentScores');
              setHighScore(0);
              setRecentScores([]);
            } catch (error) {
              console.error('Error resetting scores:', error);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Trophy size={32} color="#FFD700" />
        <Text style={styles.title}>Leaderboard</Text>
      </View>

      <View style={styles.highScoreCard}>
        <Text style={styles.highScoreLabel}>High Score</Text>
        <Text style={styles.highScoreValue}>{highScore.toLocaleString()}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Games</Text>
        <ScrollView style={styles.scoresList} showsVerticalScrollIndicator={false}>
          {recentScores.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No games played yet</Text>
              <Text style={styles.emptySubtext}>Start playing to see your scores here!</Text>
            </View>
          ) : (
            recentScores.map((entry, index) => (
              <View key={index} style={styles.scoreEntry}>
                <View style={styles.scoreInfo}>
                  <Text style={styles.scoreValue}>{entry.score.toLocaleString()}</Text>
                  <Text style={styles.roundInfo}>Round {entry.round}</Text>
                </View>
                <Text style={styles.scoreDate}>{formatDate(entry.date)}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      <TouchableOpacity style={styles.resetButton} onPress={resetScores}>
        <RotateCcw size={20} color="#ff4444" />
        <Text style={styles.resetButtonText}>Reset Scores</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 60,
    paddingHorizontal: 20,
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
  highScoreCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 2,
    borderColor: '#6200EE',
  },
  highScoreLabel: {
    fontSize: 16,
    color: '#ccc',
    fontFamily: 'Inter-Regular',
    marginBottom: 8,
  },
  highScoreValue: {
    fontSize: 48,
    color: '#FFD700',
    fontFamily: 'Inter-Bold',
  },
  section: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    color: '#fff',
    fontFamily: 'Inter-Bold',
    marginBottom: 16,
  },
  scoresList: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    fontFamily: 'Inter-Regular',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#444',
    fontFamily: 'Inter-Regular',
  },
  scoreEntry: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreInfo: {
    flex: 1,
  },
  scoreValue: {
    fontSize: 20,
    color: '#fff',
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  roundInfo: {
    fontSize: 14,
    color: '#6200EE',
    fontFamily: 'Inter-Regular',
  },
  scoreDate: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'Inter-Regular',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 20,
  },
  resetButtonText: {
    fontSize: 16,
    color: '#ff4444',
    fontFamily: 'Inter-Regular',
  },
});