import React from 'react';

interface LogoProps {
  layout?: 'horizontal' | 'vertical' | 'icon';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  className?: string;
  subtitleClassName?: string;
}

export const Logo: React.FC<LogoProps> = ({
  layout = 'horizontal',
  size = 'md',
  showSubtitle = false,
  className = '',
  subtitleClassName = '',
}) => {
  // Dimension mappings based on size
  const sizes = {
    xs: {
      icon: 'w-6 h-6',
      text: 'text-lg',
      subText: 'text-[9px]',
    },
    sm: {
      icon: 'w-8 h-8',
      text: 'text-xl',
      subText: 'text-[10px]',
    },
    md: {
      icon: 'w-10 h-10',
      text: 'text-2xl',
      subText: 'text-xs',
    },
    lg: {
      icon: 'w-14 h-14',
      text: 'text-4xl',
      subText: 'text-sm',
    },
    xl: {
      icon: 'w-24 h-24',
      text: 'text-6xl',
      subText: 'text-base',
    },
  };

  const currentSize = sizes[size];

  // Inline SVG for the beautiful brand pin icon
  const renderIcon = () => (
    <div className={`relative shrink-0 ${currentSize.icon} select-none`}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_4px_6px_rgba(0,137,123,0.15)]"
      >
        <defs>
          {/* Main Pin Gradient: Teal to Turquoise */}
          <linearGradient id="pinGrad" x1="20" y1="2" x2="80" y2="92" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00b4a4" />
            <stop offset="40%" stopColor="#00897b" />
            <stop offset="100%" stopColor="#004d40" />
          </linearGradient>

          {/* Heart Gradient: Orange Yellow to Orange Red */}
          <linearGradient id="heartGrad" x1="40" y1="23" x2="60" y2="43" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffa726" />
            <stop offset="40%" stopColor="#ff7043" />
            <stop offset="100%" stopColor="#f4511e" />
          </linearGradient>
        </defs>

        {/* Soft shadow ellipse at the bottom */}
        <ellipse cx="50" cy="94" rx="14" ry="3.5" fill="#e4e4e7" opacity="0.8" />
        <ellipse cx="50" cy="94" rx="9" ry="2" fill="#cbd5e1" opacity="0.6" />

        {/* Main Location Pin Body */}
        <path
          d="M50 92C74 61 80 47 80 34C80 15.5 66.5 2 50 2C33.5 2 20 15.5 20 34C20 47 26 61 50 92Z"
          fill="url(#pinGrad)"
        />

        {/* Outer subtle rim inside the pin */}
        <path
          d="M50 90C72 60 77 47 77 34C77 17.5 65 5 50 5C35 5 23 17.5 23 34C23 47 28 60 50 90Z"
          fill="white"
          fillOpacity="0.08"
        />

        {/* White Center Circle */}
        <circle cx="50" cy="34" r="17" fill="white" />

        {/* Heart shape in the middle of white circle */}
        <path
          d="M50 43C49.1 42.1 42 35.5 40 31.5C38 27.5 41 23.5 45 23.5C47.5 23.5 49 25.5 50 26.5C51 25.5 52.5 23.5 55 23.5C59 23.5 62 27.5 60 31.5C58 35.5 50.9 42.1 50 43Z"
          fill="url(#heartGrad)"
        />
      </svg>
    </div>
  );

  if (layout === 'icon') {
    return renderIcon();
  }

  if (layout === 'vertical') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        {renderIcon()}
        <div className="mt-4 flex flex-col items-center">
          <div className="flex items-baseline select-none">
            <span className={`${currentSize.text} font-black tracking-tight text-[#00505a]`}>Vida</span>
            <span className={`${currentSize.text} font-black tracking-tight text-[#ff6f00]`}>Local</span>
          </div>
          {showSubtitle && (
            <p className={`mt-2 font-medium text-zinc-500 leading-relaxed max-w-sm ${currentSize.subText} ${subtitleClassName}`}>
              Conectando você ao melhor da sua cidade.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Horizontal Layout (default)
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {renderIcon()}
      <div className="flex flex-col justify-center leading-none">
        <div className="flex items-baseline select-none">
          <span className={`${currentSize.text} font-black tracking-tight text-[#00505a]`}>Vida</span>
          <span className={`${currentSize.text} font-black tracking-tight text-[#ff6f00]`}>Local</span>
        </div>
        {showSubtitle && (
          <p className={`mt-1 font-medium text-zinc-500 tracking-wide select-none ${currentSize.subText} ${subtitleClassName}`}>
            Conectando você ao melhor da sua cidade.
          </p>
        )}
      </div>
    </div>
  );
};
