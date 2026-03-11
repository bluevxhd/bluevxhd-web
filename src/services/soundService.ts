class SoundService {
  private sounds: { [key: string]: HTMLAudioElement } = {};

  constructor() {
    const soundUrls: { [key: string]: string } = {
      CLICK: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
      SEND: 'https://assets.mixkit.co/active_storage/sfx/2357/2357-preview.mp3',
      COPY: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3',
      DIE: 'https://assets.mixkit.co/active_storage/sfx/2359/2359-preview.mp3',
    };

    Object.entries(soundUrls).forEach(([key, url]) => {
      this.sounds[key] = new Audio(url);
      this.sounds[key].volume = 0.3;
    });
  }

  play(key: string) {
    if (this.sounds[key]) {
      this.sounds[key].currentTime = 0;
      this.sounds[key].play().catch(() => {});
    }
  }
}

export const soundService = new SoundService();
