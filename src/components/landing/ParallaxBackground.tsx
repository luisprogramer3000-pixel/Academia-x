"use client";

import React, { useEffect, useState } from "react";

export function ParallaxBackground() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      setMousePos({ x, y });
    };

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const layer1Transform = `translate3d(${mousePos.x * 12}px, ${mousePos.y * 12 + scrollY * 0.05}px, 0)`;
  const layer2Transform = `translate3d(${mousePos.x * -25}px, ${mousePos.y * -25 + scrollY * 0.08}px, 0)`;
  const layer3Transform = `translate3d(${mousePos.x * 40}px, ${mousePos.y * 40 + scrollY * 0.12}px, 0)`;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Base Background matching --background variable */}
      <div className="absolute inset-0 bg-[var(--background)] transition-colors duration-500" />

      {/* Layer 1: Panoramic Image with adaptive mix-blend-mode */}
      <div
        className="absolute inset-0 transition-transform duration-300 ease-out opacity-15 dark:opacity-35 mix-blend-multiply dark:mix-blend-screen contrast-125 saturate-120"
        style={{
          transform: layer1Transform,
          backgroundImage: `url('/images/parallax-bg.jpg')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Layer 2: Ambient Radial Glow Orbs */}
      <div
        className="absolute inset-0 transition-transform duration-500 ease-out"
        style={{ transform: layer2Transform }}
      >
        {/* Gold Glow Top Left */}
        <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full bg-amber-400/20 dark:bg-amber-500/15 blur-[140px]" />

        {/* Cyan Glow Center Right */}
        <div className="absolute top-[40%] right-[10%] w-[600px] h-[600px] rounded-full bg-sky-300/25 dark:bg-sky-400/20 blur-[150px]" />

        {/* Gold Glow Bottom Left */}
        <div className="absolute top-[75%] left-[20%] w-[550px] h-[550px] rounded-full bg-yellow-500/20 dark:bg-yellow-600/15 blur-[140px]" />
      </div>

      {/* Layer 3: Subtle Gold Particle Mesh Grid */}
      <div
        className="absolute inset-0 opacity-20 dark:opacity-20 transition-transform duration-700 ease-out"
        style={{
          transform: layer3Transform,
          backgroundImage: `radial-gradient(rgba(180, 140, 30, 0.4) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Top & Bottom Gradient Masks matching --background */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[var(--background)] via-[var(--background)]/80 to-transparent z-10" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/80 to-transparent z-10" />
    </div>
  );
}
