import { useEffect, useRef } from "react";

export const useKeyPress = (
  targetKeys: string[],
  callback: (key: string) => void,
  disabled: boolean = false
) => {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (disabled) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      if (targetKeys.includes(event.key.toLowerCase())) {
        event.preventDefault();
        callbackRef.current(event.key.toLowerCase());
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [targetKeys, disabled]);
};
