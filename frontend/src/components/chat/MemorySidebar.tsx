"use client";

import React, { useMemo } from "react";
import { Brain, Sparkles, AlertCircle, X, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface MemorySidebarProps {
  memories: any[];
  memoryEnabled: boolean;
  onToggleMemory: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

function formatFullDateTime(val?: string): string {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const pad = (n: number) => String(n).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return String(val);
  }
}

export const MemorySidebar: React.FC<MemorySidebarProps> = ({
  memories,
  memoryEnabled,
  onToggleMemory,
  isOpen = false,
  onClose,
}) => {
  const sortedMemories = useMemo(() => {
    return [...memories].sort((a, b) => {
      const timeA = new Date(a.created_at || a.metadata?.created_at || a.updated_at || a.metadata?.timestamp || 0).getTime();
      const timeB = new Date(b.created_at || b.metadata?.created_at || b.updated_at || b.metadata?.timestamp || 0).getTime();
      return timeB - timeA;
    });
  }, [memories]);
  return (
    <>
      {/* Mobile/Tablet Backdrop Overlay (always mounted so it can fade) */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-200 lg:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        aria-hidden="true"
      />

      {/* Memory Sidebar Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[84vw] max-w-xs flex-col border-l bg-background h-full shrink-0 shadow-2xl transition-[transform,visibility] duration-200 lg:static lg:w-72 lg:shadow-none lg:z-auto",
          isOpen ? "translate-x-0 visible" : "translate-x-full invisible lg:visible lg:translate-x-0"
        )}
      >
        <div className="p-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:pt-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold">
              相关记忆
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">
                {memoryEnabled ? "开启" : "关闭"}
              </span>
              <Switch checked={memoryEnabled} onCheckedChange={onToggleMemory} aria-label="长期记忆开关" />
            </div>

            {/* Mobile Close Button */}
            <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden h-7 w-7">
              <X className="h-4 w-4" />
              <span className="sr-only">关闭</span>
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-3">
          <div className="space-y-2.5">
            {!memoryEnabled ? (
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs font-medium">长期记忆已停用</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    本次对话将不会召回或写入 Mem0 记忆库
                  </p>
                </CardContent>
              </Card>
            ) : sortedMemories.length === 0 ? (
              <Card>
                <CardContent className="p-4 text-center">
                  <Sparkles className="h-5 w-5 text-primary/60 mx-auto mb-2" />
                  <p className="text-xs font-medium">暂无关联记忆召回</p>
                  <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                    发送包含个人偏好、背景或事实的消息后，系统将自动提取长期事实并在此呈现。
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>以下为本次回复参考的背景事实：</AlertDescription>
                </Alert>
                {sortedMemories.map((m, idx) => {
                  const text = m.memory || m.text || JSON.stringify(m);
                  const createdAt = m.created_at || m.metadata?.created_at || m.updated_at || m.metadata?.timestamp;
                  const formattedTime = formatFullDateTime(createdAt);

                  return (
                    <Card key={m.id || idx}>
                      <CardContent className="p-3 text-xs leading-relaxed">
                        <p className="break-words">{text}</p>
                        {formattedTime && (
                          <>
                            <Separator className="my-2" />
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                              <Clock className="h-3 w-3 shrink-0" />
                              <span>{formattedTime}</span>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t bg-muted/40 safe-pb">
          <Button variant="ghost" size="sm" asChild className="w-full">
            <Link href="/memory" onClick={onClose}>
              <span>查看完整记忆库 →</span>
            </Link>
          </Button>
        </div>
      </aside>
    </>
  );
};
