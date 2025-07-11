import { MAX_SPEED, PADDLE_WIDTH } from '../../constants';

export const getDifficultyAdjustedSpeed = (baseSpeed: number, difficulty: 'easy' | 'normal' | 'hard') => {
  switch (difficulty) {
    case 'easy':
      return baseSpeed - 15;
    case 'hard':
      return baseSpeed + 15;
    default:
      return baseSpeed;
  }
};

export const getDifficultyAdjustedPaddleWidth = (difficulty: 'easy' | 'normal' | 'hard') => {
  switch (difficulty) {
    case 'easy':
      return PADDLE_WIDTH * 1.2; // 20% wider
    case 'hard':
      return PADDLE_WIDTH * 0.8; // 20% narrower
    default:
      return PADDLE_WIDTH;
  }
};

export const getDifficultyScoreMultiplier = (difficulty: 'easy' | 'normal' | 'hard') => {
  switch (difficulty) {
    case 'easy':
      return 0.8; // -20% score
    case 'hard':
      return 1.2; // +20% score
    default:
      return 1.0; // Normal score
  }
};