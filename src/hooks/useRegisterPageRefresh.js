import { useContext, useEffect } from 'react';
import { PageRefreshContext } from '../context/PageRefreshProvider';

const useRegisterPageRefresh = (refreshFn, deps = []) => {
    const ctx = useContext(PageRefreshContext);

    useEffect(() => {
        if (!ctx || typeof ctx.registerRefreshHandler !== 'function') return;
        return ctx.registerRefreshHandler(refreshFn);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ctx, refreshFn, ...deps]);
};

export default useRegisterPageRefresh;
