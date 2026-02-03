/**
 * Radio player state atoms (pure state, no side effects)
 */

import { atom } from "nanostores";

export type RadioState = "stopped" | "loading" | "playing" | "error";

export const radioState = atom<RadioState>("stopped");
export const radioExpanded = atom<boolean>(false);
export const radioVolume = atom<number>(0.7);
export const radioMuted = atom<boolean>(false);
export const radioTitle = atom<string>("Trucks.FM");
