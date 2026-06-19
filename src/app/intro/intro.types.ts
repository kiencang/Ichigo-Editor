export interface IntroSettings {
  enabled: boolean;
  title: string;
  subtitle: string;
  fontFamily: string;
  bgColor: string;
  textColor: string;
  duration: number; // in seconds
  audioFile: File | null;
  audioUrl: string | null;
  audioVolume: number; // 0-100
  audioType?: 'none' | 'swoosh' | 'digital-spark' | 'ambient-bell' | 'custom';
}

export const DEFAULT_INTRO_SETTINGS: IntroSettings = {
  enabled: false,
  title: 'Giới thiệu',
  subtitle: 'Hướng dẫn sử dụng',
  fontFamily: 'Inter',
  bgColor: '#000000',
  textColor: '#ffffff',
  duration: 3,
  audioFile: null,
  audioUrl: null,
  audioVolume: 100,
  audioType: 'none',
};
