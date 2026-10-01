import { useState, type ReactNode } from "react";
import { LayoutGroup, motion } from "framer-motion";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  label: string;
}

export function Tabs({ items, label }: TabsProps) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const selected = items.find((item) => item.id === selectedId);

  return (
    <div className="ui-tabs">
      <LayoutGroup>
        <div className="ui-tab-list" role="tablist" aria-label={label}>
          {items.map((item) => (
            <button
              aria-selected={selectedId === item.id}
              className="ui-tab"
              id={`tab-${item.id}`}
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              role="tab"
              type="button"
            >
              {item.label}
              {selectedId === item.id && <motion.span className="ui-tab-indicator" layoutId="tab-indicator" />}
            </button>
          ))}
        </div>
      </LayoutGroup>
      <div aria-labelledby={`tab-${selectedId}`} className="ui-tab-panel" role="tabpanel">
        {selected?.content}
      </div>
    </div>
  );
}