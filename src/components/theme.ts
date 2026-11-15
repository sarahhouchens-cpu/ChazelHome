import { useColorScheme } from 'react-native';

const light = {
  bg: '#F6F4EF',
  card: '#FFFFFF',
  text: '#1F2421',
  textMuted: '#6B716D',
  border: '#E3E0D8',
  primary: '#4F7A6B',
  primaryText: '#FFFFFF',
  primarySoft: '#E3EDE9',
  danger: '#C0473A',
  input: '#FFFFFF',
};

const dark: typeof light = {
  bg: '#121513',
  card: '#1C201E',
  text: '#ECEFEC',
  textMuted: '#9AA19D',
  border: '#2C322F',
  primary: '#7FB19F',
  primaryText: '#0F1412',
  primarySoft: '#23312C',
  danger: '#E2756A',
  input: '#232825',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
