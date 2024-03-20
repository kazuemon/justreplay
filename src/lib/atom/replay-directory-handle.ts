import { atom } from "jotai";

export const replayDirectoryHandleAtom = atom<FileSystemDirectoryHandle | null>(null);