import { createContext, useContext } from 'react'

export interface TabsContextValue {
    value: string;
    onChange: (v: string) => void;
}

export const TabsContext = createContext<TabsContextValue | null>(null)

export const useTabsContext = () => {
    const ctx = useContext(TabsContext)

    if (!ctx) {
        throw new Error("useTabsContext must be used within a TabsProvider")
    }

    return ctx
}
