import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatVersionLine } from '../version';

interface VersionFooterProps {
  /** Extra classes for the wrapper */
  className?: string;
  /** denser layout for the Settings about row */
  compact?: boolean;
}

export const VersionFooter: React.FC<VersionFooterProps> = ({ className = '', compact = false }) => {
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useState(false);
  const line = formatVersionLine(i18n.language || 'en');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(line);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers / insecure contexts
      try {
        const ta = document.createElement('textarea');
        ta.value = line;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={t('settings.version_tap_to_copy', 'Tap to copy')}
      aria-label={t('settings.version_tap_to_copy', 'Tap to copy')}
      data-testid="version-footer"
      className={
        compact
          ? `w-full text-left text-sm hover:opacity-70 transition-opacity ${className}`
          : `w-full text-center text-[10px] leading-relaxed text-muted/50 hover:text-muted transition-colors tracking-wide ${className}`
      }
    >
      {compact ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">{t('settings.version')}</span>
          <span className="font-medium text-ink text-right text-xs sm:text-sm break-all">
            {copied ? t('settings.version_copied', 'Copied') : line}
          </span>
        </div>
      ) : (
        <span>{copied ? t('settings.version_copied', 'Copied') : line}</span>
      )}
    </button>
  );
};

export default VersionFooter;
