"use client";

import React from "react";
import { useTheme, type Theme } from "@/lib/theme";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const options: { value: Theme; label: string; icon: React.FC<{ className?: string }> }[] = [
  { value: "system", label: "跟随系统", icon: Monitor },
  { value: "light", label: "浅色模式", icon: Sun },
  { value: "dark", label: "深色模式", icon: Moon },
];

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          title={`切换主题 (当前: ${theme === "system" ? "跟随系统" : theme === "light" ? "浅色模式" : "深色模式"})`}
        >
          {theme === "system" ? (
            <Monitor className="h-4 w-4" />
          ) : theme === "light" ? (
            <Sun className="h-4 w-4 text-amber-500" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          <span className="sr-only">切换主题</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          界面外观
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((opt) => {
          const Icon = opt.icon;
          const isSelected = theme === opt.value;
          return (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={
                isSelected ? "bg-accent text-accent-foreground" : undefined
              }
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{opt.label}</span>
              {isSelected && <Check className="ml-auto h-3.5 w-3.5" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
