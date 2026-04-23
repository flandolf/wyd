export const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#0ea5e9', // cyan
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
] as const

export type PresetColor = typeof PRESET_COLORS[number]

export const DEFAULT_SUBJECT_COLOR = '#22c55e'

export const CHART_COLORS = {
  bar: '#3b82f6',
  morning: '#fcd34d',
  afternoon: '#f97316',
  evening: '#3b82f6',
  night: '#1e3a8a',
} as const