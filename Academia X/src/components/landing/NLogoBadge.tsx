"use client";

import React from "react";
import Image from "next/image";

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
      className={`relative inline-flex items-center justify-center transition-all duration-300 ${dimensions} ${className}`}
    >
      <Image
        src="/images/LOGO STUDIO GLOBAL.png"
        alt="Mentor Studio Global Logo"
        fill
        sizes="64px"
        className="object-contain"
      />
    </div>
  );
}
