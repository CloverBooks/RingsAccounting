import React, { useEffect, useState } from "react";
import ChartOfAccountsPage, { type ChartOfAccountsBootPayload } from "../ChartOfAccountsPage";
import { buildApiUrl, fetchWithTimeout } from "../api/client";
import { qboDefaultCoaPayload } from "../coa/qboDefaultCoa";

const ChartOfAccountsRoute: React.FC = () => {
  const [payload, setPayload] = useState<ChartOfAccountsBootPayload>(qboDefaultCoaPayload);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let aborted = false;
    setIsLoading(true);

    fetchWithTimeout(
      buildApiUrl("/api/chart-of-accounts/"),
      {
        headers: { Accept: "application/json" },
        credentials: "include",
      },
      12_000,
    )
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load chart of accounts (${res.status})`);
        }
        const data = await res.json();
        if (aborted) return;
        setPayload({
          accounts: Array.isArray(data?.accounts) ? data.accounts : [],
          currencyCode: typeof data?.currencyCode === "string" ? data.currencyCode : "USD",
          totalsByType: typeof data?.totalsByType === "object" && data?.totalsByType ? data.totalsByType : {},
        });
      })
      .catch((error) => {
        if (aborted) {
          return;
        }
        void error;
      })
      .finally(() => {
        if (!aborted) {
          setIsLoading(false);
        }
      });
    return () => {
      aborted = true;
    };
  }, []);

  if (isLoading && payload.accounts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Loading chart of accounts...
      </div>
    );
  }

  return <ChartOfAccountsPage payload={payload} newAccountUrl="/chart-of-accounts/new" />;
};

export default ChartOfAccountsRoute;
