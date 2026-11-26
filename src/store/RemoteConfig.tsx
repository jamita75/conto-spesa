import Constants from 'expo-constants';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import { EMPTY_CONFIG, fetchRemoteConfig, type RemoteConfig, updateNeed, type UpdateNeed } from '../features/remote/config';

type Ctx = { config: RemoteConfig; need: UpdateNeed; versionCode: number | null };
const RemoteConfigContext = createContext<Ctx>({ config: EMPTY_CONFIG, need: null, versionCode: null });

/** versionCode Android della versione installata (dall'app.json incorporato nell'app) */
export function installedVersionCode(): number | null {
  const v = Constants.expoConfig?.android?.versionCode;
  return typeof v === 'number' && v > 0 ? v : null;
}

/** Legge config/app.json all'apertura e ogni volta che l'app torna in primo piano. */
export function RemoteConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<RemoteConfig>(EMPTY_CONFIG);
  const versionCode = installedVersionCode();

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchRemoteConfig().then((c) => {
        if (alive && c) setConfig(c);
      });
    load();
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return (
    <RemoteConfigContext.Provider value={{ config, need: updateNeed(versionCode, config), versionCode }}>
      {children}
    </RemoteConfigContext.Provider>
  );
}

export const useRemoteConfig = () => useContext(RemoteConfigContext);
