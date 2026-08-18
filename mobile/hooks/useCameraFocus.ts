import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

export function useCameraFocus() {
  const [active, setActive] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const generation = useRef(0);

  useFocusEffect(
    useCallback(() => {
      generation.current += 1;
      setCameraKey(generation.current);
      setActive(true);
      return () => setActive(false);
    }, [])
  );

  return { active, cameraKey };
}
