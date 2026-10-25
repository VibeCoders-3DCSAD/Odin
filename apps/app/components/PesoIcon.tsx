import Svg, { Path } from "react-native-svg";

type Props = { size?: number; color?: string };

// Phosphor has no peso glyph; this follows its bold weight on the same 256 grid.
export function PesoIcon({ size = 24, color = "currentColor" }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" fill="none" stroke={color} strokeWidth={24} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M80 216V40h56a48 48 0 0 1 0 96H80" />
      <Path d="M48 72h160M48 104h160" />
    </Svg>
  );
}
