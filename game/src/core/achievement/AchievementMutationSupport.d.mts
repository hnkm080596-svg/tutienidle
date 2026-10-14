export function readSource(file: string): string
export function createCandidate(id: string, provenance: string): string
export function writeCandidate(id: string, file: string, compiled: string): void
export function runCandidate(id: string, scenario: string): string
export function runLatestCandidate(id: string, scenario: string): string
