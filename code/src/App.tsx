import { useEffect, useState } from "react";
import { getAppSummary } from "./core/api/ipcClient";
import { moduleRegistry } from "./modules";
import type { AppSummary } from "./core/api/contracts";

export default function App() {
  const [summary, setSummary] = useState<AppSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAppSummary()
      .then(setSummary)
      .catch(() => setError("تعذر تحميل بيانات التطبيق."));
  }, []);

  const enabledIds = new Set(summary?.enabledModules.map((module) => module.id));
  const enabledModules = moduleRegistry.filter((module) => enabledIds.has(module.id));

  return (
    <main className="container py-4">
      <h1 className="h3 mb-4">LeaveDesk</h1>
      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : (
        <>
          <section className="mb-4" aria-labelledby="employee-count-heading">
            <h2 id="employee-count-heading" className="h5">
              عدد الموظفين
            </h2>
            <p className="employee-count fs-2 mb-0" aria-live="polite">
              {summary ? summary.employeeCount : "..."}
            </p>
          </section>
          <section aria-labelledby="modules-heading">
            <h2 id="modules-heading" className="h5">
              وحدات التطبيق
            </h2>
            {summary ? (
              <ul className="list-group">
                {enabledModules.map((module) => (
                  <li className="list-group-item" key={module.id}>
                    {module.nameAr}
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status">جارٍ تحميل الوحدات...</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}