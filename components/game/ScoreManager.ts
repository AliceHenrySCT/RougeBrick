import AsyncStorage from '@react-native-async-storage/async-storage';

interface ScoreEntry {
  score: number;
  round: number;
  date: string;
}

export const saveRecentScore = async (finalScore: number, finalRound: number) => {
  try {
    const existingScores = await AsyncStorage.getItem('recentScores');
    const scores = existingScores ? JSON.parse(existingScores) : [];
    
    const newScore = {
      score: finalScore,
      round: finalRound,
      date: new Date().toISOString(),
    };
    
    scores.unshift(newScore);
    
    // Keep only the last 10 scores
    if (scores.length > 10) {
      scores.splice(10);
    }
    
    await AsyncStorage.setItem('recentScores', JSON.stringify(scores));
  } catch (error) {
    console.error('Error saving recent score:', error);
  }
};