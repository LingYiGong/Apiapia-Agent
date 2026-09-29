"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Cat, KeyRound, Mail, User as UserIcon, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (isRegister) {
        const res = await apiRequest("/auth/register", {
          method: "POST",
          body: JSON.stringify({ username, email, password }),
        });
        login(res.access_token, res.user);
      } else {
        const res = await apiRequest("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            username_or_email: username || email,
            password,
          }),
        });
        login(res.access_token, res.user);
      }
      router.push("/chat");
    } catch (err: any) {
      setError(err.message || "请求失败，请检查输入或稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-3 sm:p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-lg shadow-indigo-500/25 mb-3">
            <Cat className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl tracking-tight">Apiapia 助理</CardTitle>
          <CardDescription>一只拥有长期记忆的猫咪助理</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Tab Toggle */}
          <Tabs
            value={isRegister ? "register" : "login"}
            onValueChange={(v) => {
              setIsRegister(v === "register");
              setError("");
            }}
            className="mb-6"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">登录</TabsTrigger>
              <TabsTrigger value="register">注册</TabsTrigger>
            </TabsList>
          </Tabs>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">用户名</Label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  className="pl-10 text-base sm:text-sm"
                />
              </div>
            </div>

            {isRegister && (
              <div className="space-y-1.5">
                <Label htmlFor="email">电子邮箱</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your-email@example.com"
                    className="pl-10 text-base sm:text-sm"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 text-base sm:text-sm"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:brightness-110 shadow-lg shadow-indigo-600/30 mt-6"
              size="lg"
            >
              {submitting ? "正在处理..." : isRegister ? "创建账户" : "立即登录"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
