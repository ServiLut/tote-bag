'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';

const images = [
  '/images/b2b/b2b-1.png',
  '/images/b2b/b2b-2.png',
  '/images/b2b/b2b-3.png',
  '/images/b2b/b2b-4.png',
  '/images/b2b/b2b-5.png',
  '/images/b2b/b2b-6.png',
  '/images/b2b/b2b-7.png',
];

export default function ImageCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-theme bg-surface shadow-xl mb-12">
      <div className="relative aspect-[16/9] md:aspect-[21/9]">
        {images.map((src, index) => (
          <div
            key={src}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentIndex ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Image
              src={src}
              alt={`Tote Bag Business Case ${index + 1}`}
              fill
              className="object-cover"
              priority={index === 0}
            />
          </div>
        ))}
        
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex ? 'bg-white w-6' : 'bg-white/50'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
