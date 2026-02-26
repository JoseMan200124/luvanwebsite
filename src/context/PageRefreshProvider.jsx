import React, { createContext, useCallback, useMemo, useRef, useState } from 'react';

export const PageRefreshContext = createContext(null);

const PageRefreshProvider = ({ children }) => {
    const [outletKey, setOutletKey] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const refreshHandlerRef = useRef(null);
    const inFlightRef = useRef(false);

    const registerRefreshHandler = useCallback((handler) => {
        refreshHandlerRef.current = typeof handler === 'function' ? handler : null;

        return () => {
            if (refreshHandlerRef.current === handler) {
                refreshHandlerRef.current = null;
            }
        };
    }, []);

    const triggerRefresh = useCallback(async () => {
        if (inFlightRef.current) return;

        const scrollX = window.scrollX || 0;
        const scrollY = window.scrollY || 0;
        let userScrolled = false;
        const onScroll = () => {
            userScrolled = true;
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        inFlightRef.current = true;
        setIsRefreshing(true);
        try {
            const handler = refreshHandlerRef.current;
            if (typeof handler === 'function') {
                await handler();
            } else {
                // Fallback global: remount the active route component so its
                // data-loading effects run again, without browser reload.
                setOutletKey((k) => k + 1);
            }

            // If something auto-scrolled the page during refresh (remounts, effects, etc),
            // restore the previous scroll position unless the user scrolled intentionally.
            const restoreIfNeeded = () => {
                if (userScrolled) return;
                const currentX = window.scrollX || 0;
                const currentY = window.scrollY || 0;
                if (currentX !== scrollX || currentY !== scrollY) {
                    window.scrollTo(scrollX, scrollY);
                }
            };

            // Try a few times because some pages scroll in effects after state updates.
            await new Promise((resolve) => requestAnimationFrame(resolve));
                restoreIfNeeded();
            await new Promise((resolve) => setTimeout(resolve, 50));
            restoreIfNeeded();
            await new Promise((resolve) => setTimeout(resolve, 200));
            restoreIfNeeded();
        } finally {
            window.removeEventListener('scroll', onScroll);
            inFlightRef.current = false;
            setIsRefreshing(false);
        }
    }, []);

    const value = useMemo(
        () => ({
            outletKey,
            isRefreshing,
            triggerRefresh,
            registerRefreshHandler,
        }),
        [outletKey, isRefreshing, triggerRefresh, registerRefreshHandler]
    );

    return <PageRefreshContext.Provider value={value}>{children}</PageRefreshContext.Provider>;
};

export default PageRefreshProvider;
