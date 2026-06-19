import { IntroSettings } from '../intro/intro.types';

export function drawIntroOnContext(
  ctx: CanvasRenderingContext2D,
  settings: IntroSettings,
  elapsed: number,
  w: number,
  h: number,
) {
  ctx.save();

  // Fade in
  const opacity = Math.min(1, elapsed / 0.5); // 0.5s fade in
  // Fade out at end
  const fadeOutStart = settings.duration - 0.5;
  let finalOpacity = Math.max(0, opacity);
  if (elapsed > fadeOutStart) {
    finalOpacity = Math.max(
      0,
      (settings.duration - Math.max(0, elapsed)) / 0.5,
    );
  }
  ctx.globalAlpha = finalOpacity;

  // Background
  ctx.fillStyle = settings.bgColor;
  ctx.fillRect(0, 0, w, h);

  // Scale text gently
  const scale = 1 + elapsed * 0.05; // slight zoom in over time

  ctx.translate(w / 2, h / 2);
  ctx.scale(scale, scale);

  ctx.fillStyle = settings.textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Font selection
  const mainFontSize = Math.round(h * 0.08);
  const subFontSize = Math.round(h * 0.04);

  if (settings.title) {
    ctx.font = `bold ${mainFontSize}px "${settings.fontFamily}", sans-serif`;
    const yOffset = settings.subtitle ? -mainFontSize * 0.5 : 0;
    ctx.fillText(settings.title, 0, yOffset);
  }

  if (settings.subtitle) {
    ctx.font = `normal ${subFontSize}px "${settings.fontFamily}", sans-serif`;
    const yOffset = settings.title ? mainFontSize * 0.6 : 0;
    ctx.fillText(settings.subtitle, 0, yOffset);
  }

  ctx.restore();
}
