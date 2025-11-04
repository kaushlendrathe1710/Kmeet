import { useEffect, useRef } from "react";

export interface RoomState {
  roomId: string;
  participantName: string;
  participantId: string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  videoQuality: string;
  currentPreset: string;
  viewMode: string;
  hideSelfView: boolean;
  gridColumns: number;
  videoSettings: {
    brightness: number;
    contrast: number;
    saturation: number;
  };
  timestamp: number;
}

const AUTO_SAVE_KEY = "podcastmeet_room_state";
const AUTO_SAVE_INTERVAL = 5000;

export function useAutoSave(state: Partial<RoomState>, enabled: boolean = true) {
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const saveState = () => {
      try {
        const stateToSave = {
          ...state,
          timestamp: Date.now(),
        };
        localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(stateToSave));
      } catch (error) {
        console.error("Error auto-saving room state:", error);
      }
    };

    saveState();
    intervalRef.current = window.setInterval(saveState, AUTO_SAVE_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [JSON.stringify(state), enabled]);

  return null;
}

export function recoverRoomState(roomId: string): Partial<RoomState> | null {
  try {
    const savedState = localStorage.getItem(AUTO_SAVE_KEY);
    if (!savedState) {
      return null;
    }

    const state: RoomState = JSON.parse(savedState);
    
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (state.timestamp < fiveMinutesAgo) {
      localStorage.removeItem(AUTO_SAVE_KEY);
      return null;
    }

    if (state.roomId !== roomId) {
      return null;
    }

    return state;
  } catch (error) {
    console.error("Error recovering room state:", error);
    return null;
  }
}

export function clearSavedRoomState() {
  try {
    localStorage.removeItem(AUTO_SAVE_KEY);
  } catch (error) {
    console.error("Error clearing saved room state:", error);
  }
}
