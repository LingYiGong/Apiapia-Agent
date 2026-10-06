"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "@/types";
import { apiRequest, ApiError, getToken, setToken, removeToken } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
  refreshUser: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const userData = await apiRequest<User>("/auth/me");
      setUser(userData);
    } catch (err) {
      // 只有明确的鉴权失败才清除凭据。此前这里无条件 `removeToken()`，
      // 一次后端 5xx、网关超时或瞬时断网就会永久登出——token 被删除后
      // 登录页无法解释原因，用户只能重新输密码，且没有任何恢复路径。
      //
      // 其他情况（5xx / 断网 / 超时）保留 token：
      // - 首次挂载时 user 本就是 null，视图照常跳登录页；
      // - 已有登录态时保留旧 user，避免网络抖动把正在使用的人踢下线；
      //   下次刷新或重新进入应用会静默重试。
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        removeToken();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = (token: string, userData: User) => {
    setToken(token);
    setUser(userData);
  };

  const logout = () => {
    removeToken();
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
