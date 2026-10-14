import React from 'react';

interface LogoProps {
  variant?: 'full' | 'mark-only' | 'wordmark-only' | 'compact';
  className?: string;
  light?: boolean;
}

/**
 * Uploaded "Medium Logo.svg":
 * Royal Blue background (#162884) with the official stylized serif "M"
 * featuring the faceted left cut, classical right column pillar, and 4-point sparkle star (✦)
 */
export const MediumMark: React.FC<{ size?: number; className?: string }> = ({
  size = 42,
  className = '',
}) => {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative flex-shrink-0 flex items-center justify-center rounded-lg bg-[#162884] overflow-hidden ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[82%] h-[82%]"
        aria-label="MEDIUM Official Logo"
      >
        {/* Left faceted angled stroke */}
        <path
          d="M24 25H38L49.5 54.5L44 69L24 25Z"
          fill="white"
        />
        {/* Top serif on left stroke */}
        <path
          d="M23 25H39V27.5H23V25Z"
          fill="white"
        />

        {/* Right Roman column pillar with classical bilateral serifs */}
        <path
          d="M59.5 28.5H70.5V65.5H59.5V28.5Z"
          fill="white"
        />
        {/* Top bracket serif */}
        <path
          d="M56 25H74C74 25 72 26 71.5 28.5H58.5C58 26 56 25 56 25Z"
          fill="white"
        />
        {/* Bottom bracket serif */}
        <path
          d="M56 69H74C74 69 72 68 71.5 65.5H58.5C58 68 56 69 56 69Z"
          fill="white"
        />

        {/* 4-point sparkle star (✦) at lower left */}
        <path
          d="M28.5 76C28.5 72.5 23 70 23 70C23 70 28.5 67.5 28.5 64C28.5 67.5 34 70 34 70C34 70 28.5 72.5 28.5 76Z"
          fill="white"
        />
      </svg>
    </div>
  );
};

/**
 * Official "MEDIUM EVENTS" name artwork (from "Medium Name BGR.svg"), with its blue background removed:
 * white lettering for dark backgrounds, brand blue for light ones.
 * The files are in public/images/brand/.
 */
export const MediumWordmark: React.FC<{ light?: boolean; className?: string }> = ({
  light = true,
  className = '',
}) => (
  <img
    src={`/images/brand/medium-events-wordmark-${light ? 'white' : 'blue'}.png`}
    alt="MEDIUM Events"
    width={720}
    height={161}
    // shrink-0 and max-w-none: the lettering keeps its proportions when the header gets tight
    className={`h-9 sm:h-10 w-auto max-w-none shrink-0 select-none ${className}`}
  />
);

export const Logo: React.FC<LogoProps> = ({ variant = 'full', className = '', light = true }) => {
  if (variant === 'mark-only') {
    return <MediumMark className={className} />;
  }

  if (variant === 'wordmark-only') {
    return <MediumWordmark light={light} className={className} />;
  }

  return (
    <div className={`flex items-center gap-3.5 select-none group ${className}`}>
      {/* Uploaded "Medium Logo.svg" Mark */}
      <MediumMark size={40} />

      {/* Official name artwork with its background removed */}
      {variant !== 'compact' && <MediumWordmark light={light} />}
    </div>
  );
};
