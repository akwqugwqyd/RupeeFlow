import { useCallback, useEffect, useState } from "react";

export function useAsyncData<T>(loader: () => Promise<T>, dependencies: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loader());
    } catch (caught: any) {
      setError(caught.response?.data?.message || caught.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}
