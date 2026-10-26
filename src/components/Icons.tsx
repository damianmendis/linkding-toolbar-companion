/**
 * Inline SVG icons for icon-only buttons.
 *
 * Unicode symbols (↻, ⚙, ✏, 🔗) aren't in most UI fonts, so the browser pulls each
 * one from whatever fallback font the OS has -- different glyphs end up at
 * visibly different sizes (or as colour emoji). SVGs render identically
 * everywhere and inherit the surrounding text colour via currentColor, so
 * they follow the light/dark theme tokens in globals.css. Whatever colour
 * they're given must keep >= 3:1 against its background (WCAG 1.4.11).
 */
import React from 'react';

type IconProps = React.SVGProps<SVGSVGElement>;

function Icon({ children, ...rest }: IconProps) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 3v10M3 8h10" />
    </Icon>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* ~300° clockwise arc, open at the top-right, with an arrowhead on its end */}
      <path d="M13 8a5 5 0 1 1-1.46-3.54" />
      <path d="M12 1.75v3h-3" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="7" cy="7" r="4.25" />
      <path d="M10.25 10.25 13.5 13.5" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Icon>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* pencil: body from bottom-left to top-right, with the tip at 2.5,13.5 */}
      <path d="M10.5 2.5l3 3-8 8H2.5v-3z" />
      <path d="M9 4l3 3" />
    </Icon>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* two interlocking chain links */}
      <path d="M6.5 9.5l3-3" />
      <path d="M7.5 4.5l1-1a2.83 2.83 0 0 1 4 4l-1 1" />
      <path d="M8.5 11.5l-1 1a2.83 2.83 0 0 1-4-4l1-1" />
    </Icon>
  );
}

export function SettingsIcon(props: IconProps) {
  // 8 teeth around a ring; drawn as short radial strokes for a crisp gear
  // at 16px without a hand-tuned outline path.
  const teeth = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    return <line key={i} x1={8 + 4.6 * c} y1={8 + 4.6 * s} x2={8 + 6.6 * c} y2={8 + 6.6 * s} strokeWidth={2} />;
  });
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="4.25" />
      <circle cx="8" cy="8" r="1.75" />
      {teeth}
    </Icon>
  );
}
