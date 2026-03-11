import React, { useEffect, useState } from "react";
import { buildApiUrl, fetchWithTimeout, getAccessToken } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import AccountSettingsPage, { type AccountSettingsProps } from "../settings/AccountSettingsPage";

const AccountSettingsRoute: React.FC = () => {
  const [payload, setPayload] = useState<AccountSettingsProps | null>(null);
  const [loading, setLoading] = useState(true);
  const { auth } = useAuth();

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    fetchWithTimeout(
      buildApiUrl("/api/settings/bootstrap/"),
      {
        headers: {
          Accept: "application/json",
          ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
        },
        credentials: "include",
      },
      10_000,
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!mounted) return;
        setPayload({
          csrfToken: String(data?.csrfToken || data?.csrf_token || ""),
          profileForm: data?.profileForm || data?.profile_form || null,
          businessForm: data?.businessForm || data?.business_form || null,
          passwordForm: data?.passwordForm || data?.password_form || null,
          sessions: data?.sessions || {},
          postUrls: data?.postUrls || {
            profile: "/api/settings/profile/",
            business: "/api/settings/business/",
            password: "/api/settings/password/",
            logoutAll: "/api/auth/logout-all/",
          },
          messages: Array.isArray(data?.messages) ? data.messages : [],
          taxSettings: data?.taxSettings || data?.tax_settings,
        });
      })
      .catch(() => {
        if (!mounted) return;
        setPayload({
          csrfToken: "",
          profileForm: null,
          businessForm: null,
          passwordForm: null,
          sessions: { user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "" },
          postUrls: {
            profile: "/api/settings/profile/",
            business: "/api/settings/business/",
            password: "/api/settings/password/",
            logoutAll: "/api/auth/logout-all/",
          },
          messages: [],
        });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [auth.user?.id]);

  if (loading || !payload) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Loading settings...
      </div>
    );
  }

  return <AccountSettingsPage {...payload} />;
};

export default AccountSettingsRoute;
