import React from 'react';
import { createPortal } from 'react-dom';

export interface ScopeGridRow {
  key: string;
  label: string;
}

interface SetScopeGridProps {
  /** Row definitions (e.g., prompt sections) */
  rows: ScopeGridRow[];
  /** Column names (e.g., tag names + 'All') */
  columns: string[];
  /** Currently selected cell IDs (format: "ColumnName-rowKey") */
  selected: string[];
  /** Called with updated selection array whenever cells change */
  onSave: (selected: string[]) => void;
  /** Called when the grid should close */
  onClose: () => void;
  /** Header title */
  title?: string;
  /** Color scheme for checked cells */
  colorScheme?: 'indigo' | 'emerald' | 'purple';
}

const colorMap = {
  indigo: { checked: 'bg-indigo-600 border-indigo-500 text-white', label: 'text-indigo-300' },
  emerald: { checked: 'bg-emerald-600 border-emerald-500 text-white', label: 'text-emerald-300' },
  purple: { checked: 'bg-purple-600 border-purple-500 text-white', label: 'text-purple-300' },
};

const SetScopeGrid: React.FC<SetScopeGridProps> = ({
  rows,
  columns,
  selected,
  onSave,
  onClose,
  title = 'Set Scope',
  colorScheme = 'indigo',
}) => {
  const colors = colorMap[colorScheme];

  const toggleCell = (col: string, rowKey: string) => {
    const cellId = `${col}-${rowKey}`;
    const updated = selected.includes(cellId)
      ? selected.filter(x => x !== cellId)
      : [...selected, cellId];
    onSave(updated);
  };

  const toggleColumn = (col: string) => {
    const colCells = rows.map(r => `${col}-${r.key}`);
    const allChecked = colCells.every(c => selected.includes(c));
    const updated = allChecked
      ? selected.filter(x => !colCells.includes(x))
      : [...new Set([...selected, ...colCells])];
    onSave(updated);
  };

  const toggleRow = (rowKey: string) => {
    const rowCells = columns.map(c => `${c}-${rowKey}`);
    const allChecked = rowCells.every(c => selected.includes(c));
    const updated = allChecked
      ? selected.filter(x => !rowCells.includes(x))
      : [...new Set([...selected, ...rowCells])];
    onSave(updated);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 border border-slate-600 rounded-lg shadow-2xl p-4 max-w-[560px] w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr>
                <th className="text-left text-slate-400 pr-2 py-1"></th>
                {columns.map(col => (
                  <th key={col} className="text-center px-1 py-1">
                    <button
                      onClick={() => toggleColumn(col)}
                      className="text-slate-300 hover:text-white font-medium transition"
                    >
                      {col}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key}>
                  <td className="pr-2 py-1">
                    <button
                      onClick={() => toggleRow(row.key)}
                      className="text-slate-300 hover:text-white text-left transition whitespace-nowrap"
                    >
                      {row.label}
                    </button>
                  </td>
                  {columns.map(col => {
                    const cellId = `${col}-${row.key}`;
                    const isChecked = selected.includes(cellId);
                    return (
                      <td key={col} className="text-center px-1 py-1">
                        <button
                          onClick={() => toggleCell(col, row.key)}
                          className={`w-5 h-5 rounded border transition ${
                            isChecked
                              ? colors.checked
                              : 'bg-slate-700 border-slate-600 text-slate-500 hover:border-slate-400'
                          }`}
                        >
                          {isChecked ? '✓' : ''}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Select All / Clear All */}
          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-700">
            <button
              onClick={() => {
                const allCells = columns.flatMap(col => rows.map(r => `${col}-${r.key}`));
                onSave(allCells);
              }}
              className="px-2 py-1 text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition"
            >
              Select All
            </button>
            <button
              onClick={() => onSave([])}
              className="px-2 py-1 text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition"
            >
              Clear All
            </button>
            <span className="text-[10px] text-slate-500 ml-auto">
              {selected.length} selected
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SetScopeGrid;
