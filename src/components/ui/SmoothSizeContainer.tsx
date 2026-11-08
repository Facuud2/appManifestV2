'use client';

import React from 'react';
import { ElasticContainer } from '@/components/ui/ElasticContainer';

/**
 * Named alias for the elastic height container used by the attachment row.
 * Keeping the name explicit makes the composer code read like the design spec.
 */
export const SmoothSizeContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <ElasticContainer className={className}>{children}</ElasticContainer>
);
