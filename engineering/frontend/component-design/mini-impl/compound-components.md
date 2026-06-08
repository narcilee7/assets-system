# 手写 Compound Components

## 1. Tabs 复合组件

```tsx
// Tabs.tsx
import { createContext, useContext, useState, useCallback } from 'react';

// ============ Context ============
interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs subcomponents must be used within <Tabs>');
  }
  return context;
}

// ============ Root ============
interface TabsProps {
  defaultTab?: string;
  children: React.ReactNode;
}

function Tabs({ defaultTab, children }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || '');

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
}

// ============ List ============
function TabList({ children }: { children: React.ReactNode }) {
  return <div className="tab-list" role="tablist">{children}</div>;
}

// ============ Tab ============
interface TabProps {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
}

function Tab({ id, children, disabled }: TabProps) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === id;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`panel-${id}`}
      id={`tab-${id}`}
      tabIndex={isActive ? 0 : -1}
      className={isActive ? 'tab active' : 'tab'}
      onClick={() => !disabled && setActiveTab(id)}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

// ============ Panel ============
interface TabPanelProps {
  id: string;
  children: React.ReactNode;
}

function TabPanel({ id, children }: TabPanelProps) {
  const { activeTab } = useTabsContext();
  const isActive = activeTab === id;

  if (!isActive) return null;

  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      className="tab-panel"
    >
      {children}
    </div>
  );
}

// ============ 注册子组件 ============
Tabs.List = TabList;
Tabs.Tab = Tab;
Tabs.Panel = TabPanel;

// ============ 使用 ============

function App() {
  return (
    <Tabs defaultTab="account">
      <Tabs.List>
        <Tabs.Tab id="account">Account</Tabs.Tab>
        <Tabs.Tab id="password">Password</Tabs.Tab>
        <Tabs.Tab id="settings">Settings</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel id="account">
        <h2>Account Settings</h2>
        <p>Manage your account information.</p>
      </Tabs.Panel>

      <Tabs.Panel id="password">
        <h2>Change Password</h2>
        <form>...</form>
      </Tabs.Panel>

      <Tabs.Panel id="settings">
        <h2>General Settings</h2>
        <p>Configure your preferences.</p>
      </Tabs.Panel>
    </Tabs>
  );
}
```

## 2. 键盘导航增强

```tsx
function TabList({ children }: { children: React.ReactNode }) {
  const { activeTab, setActiveTab } = useTabsContext();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const tabs = React.Children.toArray(children) as React.ReactElement<TabProps>[];
    const enabledTabs = tabs.filter((tab) => !tab.props.disabled);
    const currentIndex = enabledTabs.findIndex((tab) => tab.props.id === activeTab);

    let nextIndex: number;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        nextIndex = (currentIndex + 1) % enabledTabs.length;
        setActiveTab(enabledTabs[nextIndex].props.id);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        nextIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;
        setActiveTab(enabledTabs[nextIndex].props.id);
        break;
      case 'Home':
        e.preventDefault();
        setActiveTab(enabledTabs[0].props.id);
        break;
      case 'End':
        e.preventDefault();
        setActiveTab(enabledTabs[enabledTabs.length - 1].props.id);
        break;
    }
  };

  return (
    <div className="tab-list" role="tablist" onKeyDown={handleKeyDown}>
      {children}
    </div>
  );
}
```
