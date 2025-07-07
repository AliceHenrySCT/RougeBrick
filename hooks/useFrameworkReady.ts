import { useEffect, useState } from 'react';

export function useFrameworkReady() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Framework initialization logic
    setIsReady(true);
  }, []);

  return isReady;
}