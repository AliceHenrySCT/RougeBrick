import { useSharedValue } from 'react-native-reanimated';

export const useGameState = (currentScore: number, lives: number, extraBalls: number, speedBoostCount: number, difficulty: 'easy' | 'normal' | 'hard') => {
  const brickCount = useSharedValue(0);
  const score = useSharedValue(currentScore);
  const currentLives = useSharedValue(lives);
  const gameEnded = useSharedValue(false);
  const shouldSaveScore = useSharedValue(false);
  const finalScoreToSave = useSharedValue(0);
  const finalRoundToSave = useSharedValue(0);
  const shouldTriggerGameEnd = useSharedValue(false);
  const gameWon = useSharedValue(false);
  const hapticEnabled = useSharedValue(true);
  const shouldUpdateLives = useSharedValue(false);
  const newLivesCount = useSharedValue(0);
  const scoreMultiplier = useSharedValue(1.0);
  
  // Extra ball system
  const extraBallPowerUps = useSharedValue(extraBalls);
  const hasUsedExtraBalls = useSharedValue(false);
  const extraBallSpawnTime = useSharedValue(0);
  const shouldCopyVelocity = useSharedValue(false);
  const currentMaxSpeed = useSharedValue(0);

  return {
    brickCount,
    score,
    currentLives,
    gameEnded,
    shouldSaveScore,
    finalScoreToSave,
    finalRoundToSave,
    shouldTriggerGameEnd,
    gameWon,
    hapticEnabled,
    shouldUpdateLives,
    newLivesCount,
    scoreMultiplier,
    extraBallPowerUps,
    hasUsedExtraBalls,
    extraBallSpawnTime,
    shouldCopyVelocity,
    currentMaxSpeed,
  };
};