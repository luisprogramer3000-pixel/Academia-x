"use client";

import React from "react";

interface NLogoBadgeProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function NLogoBadge({ size = "md", className = "" }: NLogoBadgeProps) {
  const dimensions = {
    sm: "w-8 h-8",
    md: "w-11 h-11",
    lg: "w-16 h-16",
  }[size];

  const svgSizes = {
    sm: 32,
    md: 44,
    lg: 64,
  }[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full bg-[#050b1a] border border-amber-500/30 shadow-[0_0_15px_rgba(212,175,55,0.25)] transition-all duration-300 hover:shadow-[0_0_25px_rgba(212,175,55,0.5)] hover:border-amber-400/60 ${dimensions} ${className}`}
    >
      <svg
        width={svgSizes}
        height={svgSizes}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="transform scale-90"
      >
        <defs>
          {/* Metallic Gold / Silver Gradient for the Letter N */}
          <linearGradient id="nGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="45%" stopColor="#E2E8F0" />
            <stop offset="70%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#AA7C11" />
          </linearGradient>

          {/* Light Cut Slash Effect Gradient */}
          <linearGradient id="slashGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#050B1A" stopOpacity="0" />
          </linearGradient>

          {/* Glow filter */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Circular Ring */}
        <circle
          cx="50"
          cy="50"
          r="46"
          stroke="url(#nGradient)"
          strokeWidth="1.5"
          strokeOpacity="0.4"
        />

        {/* Main Stylized Letter N */}
        {/* Left vertical bar */}
        <rect x="30" y="26" width="7" height="48" rx="1.5" fill="url(#nGradient)" />

        {/* Main Diagonal stem with cut line */}
        <path
          d="M 37 26 L 64 68 H 70 V 26 H 63 V 58 L 42 26 Z"
          fill="url(#nGradient)"
        />

        {/* Diagonal Light Cut Slash Effect across the lower right diagonal of N */}
        <line
          x1="50"
          y1="56"
          x2="72"
          y2="76"
          stroke="url(#slashGradient)"
          strokeWidth="3.5"
          strokeLinecap="round"
          filter="url(#glow)"
        />
      </svg>
    </div>
  );
}
