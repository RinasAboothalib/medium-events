import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { routeForPath } from '../routes';

// Keeps the tab title in sync on client-side navigation (pre-rendered HTML already has it)
export function usePageMeta(): void {
  const { pathname } = useLocation();
  useEffect(() => {
    const route = routeForPath(pathname);
    if (route) document.title = route.title;
  }, [pathname]);
}
