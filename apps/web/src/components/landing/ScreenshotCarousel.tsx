'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import Icon from '@mdi/react';
import { mdiChevronLeft, mdiChevronRight } from '@mdi/js';

import styles from './ScreenshotCarousel.module.css';

const SLIDES = [
  {
    src: '/screenshots/app-login.png',
    alt: 'Iron Cloud login screen',
    caption: 'Sign in with your mobile number',
  },
  {
    src: '/screenshots/app-home-awaiting.png',
    alt: 'Iron Cloud home with awaiting pickup order',
    caption: 'Track pickup and delivery in one place',
  },
  {
    src: '/screenshots/app-home-picked.png',
    alt: 'Iron Cloud home after clothes are picked up',
    caption: 'Follow every step until delivery',
  },
] as const;

export function ScreenshotCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback((next: number) => {
    setIndex((next + SLIDES.length) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % SLIDES.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, [paused]);

  const slide = SLIDES[index];

  return (
    <section
      className={styles.section}
      aria-roledescription="carousel"
      aria-label="App screenshots"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>The app</p>
          <h2 className={styles.title}>See Iron Cloud in action</h2>
          <p className={styles.description}>
            Book pickups, track partners, and manage your orders from your phone.
          </p>
        </header>

        <div className={styles.stage}>
          <button
            type="button"
            className={styles.navBtn}
            aria-label="Previous screenshot"
            onClick={() => goTo(index - 1)}
          >
            <Icon path={mdiChevronLeft} size={1.1} />
          </button>

          <figure className={styles.phone}>
            <div className={styles.phoneScreen}>
              <Image
                key={slide.src}
                src={slide.src}
                alt={slide.alt}
                width={390}
                height={844}
                className={styles.image}
                sizes="(max-width: 480px) 70vw, 280px"
                priority={index === 0}
              />
            </div>
            <figcaption className={styles.caption}>{slide.caption}</figcaption>
          </figure>

          <button
            type="button"
            className={styles.navBtn}
            aria-label="Next screenshot"
            onClick={() => goTo(index + 1)}
          >
            <Icon path={mdiChevronRight} size={1.1} />
          </button>
        </div>

        <div className={styles.dots} role="tablist" aria-label="Choose screenshot">
          {SLIDES.map((item, i) => (
            <button
              key={item.src}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show screenshot ${i + 1}`}
              className={`${styles.dot} ${i === index ? styles.dotActive : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
