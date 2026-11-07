'use client';

import React, { useEffect, useRef, useState } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { APPLE_ELASTIC_SPRING } from '@/lib/iosSprings';

interface ElasticContainerProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

/**
 * Elastic container that measures content height via ResizeObserver and animates
 * height transitions using Apple spring physics (stiffness: 400, damping: 34).
 */
export const ElasticContainer: React.FC<ElasticContainerProps> = ({
  children,
  className = '',
  id,
}) => {
  const innerRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | 'auto'>('auto');
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const node = innerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const nextHeight = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        if (nextHeight > 0) {
          setMeasuredHeight(Math.ceil(nextHeight));
        }
      }
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <LayoutGroup id={id}>
      <motion.div
        layout
        animate={{ height: prefersReducedMotion ? 'auto' : measuredHeight }}
        transition={prefersReducedMotion ? { duration: 0 } : APPLE_ELASTIC_SPRING}
        className={` overflow-hidden ${className}`}
      >
        <div ref={innerRef}>{children}</div>
      </motion.div>
    </LayoutGroup>
  );
};
