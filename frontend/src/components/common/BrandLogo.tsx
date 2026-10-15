"use client";

import React, { useState } from "react";
import { Cat } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

interface BrandLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  textClassName?: string;
  subtitle?: string;
  shape?: "squircle" | "circle";
  alt?: string;
}

/**
 * Official Apiapia Mascot & Logo Component
 * Renders the high-definition Apiapia cat avatar with subtle iOS squircle border/glow
 * and graceful fallback.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 32,
  className,
  showText = false,
  textClassName,
  subtitle,
  shape = "squircle",
  alt = "Apiapia",
}) => {
  const { t } = useI18n();
  const [imgError, setImgError] = useState(false);

  const imgSrc =
    shape === "circle" ? "/apiapia-avatar-circle.png" : "/apiapia-avatar.png";

  const radiusClass = shape === "circle" ? "rounded-full" : "rounded-[22%]";

  return (
    <div className={cn("inline-flex items-center gap-2 select-none", className)}>
      <div
        className={cn(
          "relative shrink-0 flex items-center justify-center overflow-hidden transition-transform",
          radiusClass
        )}
        style={{ width: size, height: size }}
      >
        {!imgError ? (
          <img
            src={imgSrc}
            alt={alt}
            width={size}
            height={size}
            className={cn(
              "h-full w-full object-cover select-none pointer-events-none drop-shadow-xs",
              radiusClass
            )}
            onError={() => setImgError(true)}
            loading="eager"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary text-primary-foreground">
            <Cat style={{ width: size * 0.6, height: size * 0.6 }} />
          </div>
        )}
      </div>

      {showText && (
        <div className="flex flex-col min-w-0">
          <span
            className={cn(
              "font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-200 dark:to-indigo-400 bg-clip-text text-transparent truncate",
              textClassName || "text-base tracking-wide"
            )}
          >
            {t("meta.appName")}
          </span>
          {subtitle && (
            <span className="text-xs text-muted-foreground truncate">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
