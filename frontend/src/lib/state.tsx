"use client";
import { useEffect, useRef, useState } from "react";

// useState but load initial state from local storage and save state to local storage
export function useLocalStorageState<T>(key: string, defaultValue: T): [T, (value: T) => void] {
    const [state, setState] = useState<T>(() => {
        if (typeof window === "undefined") {
            return defaultValue;
        }
        const valueInLocalStorage = window.localStorage.getItem(key);
        if (valueInLocalStorage) {
            return JSON.parse(valueInLocalStorage);
        }
        return defaultValue;
    });

    useEffect(() => {
        window.localStorage.setItem(key, JSON.stringify(state));
    }, [key, state]);

    return [state, setState];
}



export function useRefState<T>(initialState: T) {
    const [state, setState] = useState(initialState);
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);
    return [state, setState, stateRef] as const;
}