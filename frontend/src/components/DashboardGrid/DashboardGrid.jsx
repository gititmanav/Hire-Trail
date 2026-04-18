import { useState, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import RGL from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "./DashboardGrid.css";

const ResponsiveGridLayout = RGL.WidthProvider(RGL.Responsive);

const STORAGE_KEY = "hiretrail:dashboard-layout-v1";
const COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };

function loadLayouts(defaultLayouts) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultLayouts;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultLayouts;
    return parsed;
  } catch {
    return defaultLayouts;
  }
}

function DashboardGrid({ items, defaultLayouts }) {
  const [editMode, setEditMode] = useState(false);
  const [layouts, setLayouts] = useState(() => loadLayouts(defaultLayouts));

  const handleLayoutChange = useCallback((_current, all) => {
    setLayouts(all);
  }, []);

  const persist = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
    } catch {
      /* localStorage unavailable */
    }
    setEditMode(false);
  };

  const resetLayout = () => {
    setLayouts(defaultLayouts);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const renderedItems = useMemo(
    () =>
      items.map((item) => (
        <div key={item.key} className="dashboard-grid-item">
          {editMode && (
            <span
              className="dashboard-grid-handle"
              aria-hidden="true"
              title="Drag to move"
            >
              ⋮⋮
            </span>
          )}
          {item.node}
        </div>
      )),
    [items, editMode]
  );

  return (
    <div className="dashboard-grid-wrapper">
      <div className="dashboard-grid-toolbar">
        {editMode ? (
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={resetLayout}
            >
              Reset to default
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={persist}
              aria-pressed="true"
            >
              Done editing
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setEditMode(true)}
            aria-pressed="false"
          >
            Customize layout
          </button>
        )}
      </div>
      <ResponsiveGridLayout
        className={`dashboard-grid ${editMode ? "dashboard-grid-editing" : ""}`}
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={COLS}
        rowHeight={80}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        isDraggable={editMode}
        isResizable={editMode}
        draggableHandle=".dashboard-grid-handle"
        compactType="vertical"
        onLayoutChange={handleLayoutChange}
      >
        {renderedItems}
      </ResponsiveGridLayout>
    </div>
  );
}

DashboardGrid.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      node: PropTypes.node.isRequired,
    })
  ).isRequired,
  defaultLayouts: PropTypes.object.isRequired,
};

export default DashboardGrid;
