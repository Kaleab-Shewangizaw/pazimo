// Derives a small, consistent palette from the single colour an admin picks for
// a beverage.
//
// The work happens in OKLCH because sRGB/HSL lightness is not perceptual: a
// yellow and a navy at the same HSL lightness read as very different
// brightnesses, so a grid of cards tinted that way looks lumpy and some text
// falls below usable contrast. Here only the *hue* survives from the chosen
// colour — lightness and chroma are pinned to fixed targets — so every card
// sits at the same perceived brightness whatever the brand colour is, and the
// page still reads as one system.
//
// The rest of the app is already expressed in oklch() (see globals.css), so
// these values sit alongside the existing design tokens rather than beside them.

// Amber, matching the untinted "shelf" the cards used before colours existed,
// so a beverage with no colour set looks exactly as it always has.
import type { CSSProperties } from "react";

export const DEFAULT_BEVERAGE_COLOR = "#f59e0b";

export const isValidHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value.trim());

const srgbToLinear = (channel: number) =>
  channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);

interface Lch {
  l: number;
  c: number;
  h: number;
}

// sRGB hex -> OKLCH. Matrices from Björn Ottosson's Oklab derivation.
const hexToOklch = (hex: string): Lch => {
  const normalized = hex.trim().replace("#", "");
  const r = srgbToLinear(parseInt(normalized.slice(0, 2), 16) / 255);
  const g = srgbToLinear(parseInt(normalized.slice(2, 4), 16) / 255);
  const b = srgbToLinear(parseInt(normalized.slice(4, 6), 16) / 255);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const okL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const okA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const okB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const chroma = Math.sqrt(okA * okA + okB * okB);
  const hue = chroma < 1e-6 ? 0 : ((Math.atan2(okB, okA) * 180) / Math.PI + 360) % 360;

  return { l: okL, c: chroma, h: hue };
};

const oklch = (l: number, c: number, h: number) =>
  `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;

export type BeverageColorVars = CSSProperties & Record<`--bev-${string}`, string>;

// Fixed lightness targets, and chroma ceilings so a vivid pick cannot shout.
// Chroma is also scaled by the source's own chroma, so a near-grey colour
// stays near-grey instead of being pushed to a saturation it never had.
const derive = (source: Lch, targetL: number, maxC: number) =>
  oklch(targetL, Math.min(source.c, maxC), source.h);

export const getBeverageColorVars = (color?: string | null): BeverageColorVars => {
  const hex = color && isValidHexColor(color) ? color : DEFAULT_BEVERAGE_COLOR;
  const source = hexToOklch(hex);

  return {
    // The image "shelf" behind the bottle: a whisper of the colour in light
    // mode, a low-lit wash of it in dark mode.
    "--bev-panel": derive(source, 0.968, 0.042),
    // Second gradient stop, giving the shelf a soft vertical falloff instead of
    // a flat block of colour.
    "--bev-panel-2": derive(source, 0.936, 0.055),
    "--bev-panel-dark": derive(source, 0.268, 0.05),
    "--bev-panel-2-dark": derive(source, 0.216, 0.042),
    "--bev-border": derive(source, 0.902, 0.055),
    "--bev-border-dark": derive(source, 0.352, 0.05),
    // Reserved for accents on the tinted surface. Kept dark enough in light
    // mode (and light enough in dark mode) to stay legible on the panel above
    // for every hue.
    "--bev-ink": derive(source, 0.48, 0.13),
    "--bev-ink-dark": derive(source, 0.822, 0.11),
  } as BeverageColorVars;
};

// A readable swatch of the colour itself, for pickers and dots.
export const getBeverageSwatch = (color?: string | null) => {
  const hex = color && isValidHexColor(color) ? color : DEFAULT_BEVERAGE_COLOR;
  return hex;
};

// The colour a chart mark should use for this drink. Deliberately the same ink
// token the cards use: pinning lightness keeps every bar at one weight (so bar
// colour never doubles as a value ramp) and lifts contrast against the surface,
// which the raw brand colours — amber especially — do not clear on their own.
export const getBeverageInk = (color: string | null | undefined, isDark: boolean) =>
  getBeverageColorVars(color)[isDark ? "--bev-ink-dark" : "--bev-ink"];

// A starting palette for the admin picker: recognisable drink-brand hues,
// spread around the wheel so the presets don't collapse into one family.
//
// Checked with the dataviz palette validator (adjacent pairs, light surface):
// passes the lightness band, chroma floor, CVD separation and normal-vision
// floor. Two earlier entries were dropped because the tool caught what the eye
// did not — "Lager gold" sat ΔE 5.4 from Amber in normal vision and 1.4 under
// protanopia (two swatches, one apparent colour), and "Slate" fell under the
// chroma floor and simply read grey.
//
// Amber and Citrus carry a sub-3:1 contrast warning against a light surface,
// which is why anywhere these appear as chart marks is direct-labelled and
// backed by a table rather than relying on the colour alone.
export const BEVERAGE_COLOR_PRESETS: { name: string; value: string }[] = [
  { name: "Amber", value: "#f59e0b" },
  { name: "Deep blue", value: "#1d4ed8" },
  { name: "Cola red", value: "#c8102e" },
  { name: "Ice teal", value: "#0d9488" },
  { name: "Berry", value: "#9d174d" },
  { name: "Citrus", value: "#84cc16" },
  { name: "Grape", value: "#6d28d9" },
  { name: "Bottle green", value: "#1f7a3f" },
];
