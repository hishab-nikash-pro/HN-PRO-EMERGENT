import { useState, useEffect } from 'react';
import { Calendar } from '@phosphor-icons/react';

const getDateRange = (preset) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();

  switch (preset) {
    case 'today':
      return {
        start: new Date(year, month, day).toISOString().split('T')[0],
        end: new Date(year, month, day).toISOString().split('T')[0]
      };
    case 'yesterday':
      const yesterday = new Date(year, month, day - 1);
      return {
        start: yesterday.toISOString().split('T')[0],
        end: yesterday.toISOString().split('T')[0]
      };
    case 'this_week':
      const weekStart = new Date(year, month, day - today.getDay());
      return {
        start: weekStart.toISOString().split('T')[0],
        end: new Date(year, month, day).toISOString().split('T')[0]
      };
    case 'last_week':
      const lastWeekStart = new Date(year, month, day - today.getDay() - 7);
      const lastWeekEnd = new Date(year, month, day - today.getDay() - 1);
      return {
        start: lastWeekStart.toISOString().split('T')[0],
        end: lastWeekEnd.toISOString().split('T')[0]
      };
    case 'this_month':
      return {
        start: new Date(year, month, 1).toISOString().split('T')[0],
        end: new Date(year, month + 1, 0).toISOString().split('T')[0]
      };
    case 'last_month':
      return {
        start: new Date(year, month - 1, 1).toISOString().split('T')[0],
        end: new Date(year, month, 0).toISOString().split('T')[0]
      };
    case 'quarterly':
      const quarter = Math.floor(month / 3);
      const quarterStart = new Date(year, quarter * 3, 1);
      const quarterEnd = new Date(year, (quarter + 1) * 3, 0);
      return {
        start: quarterStart.toISOString().split('T')[0],
        end: quarterEnd.toISOString().split('T')[0]
      };
    case 'yearly':
      return {
        start: new Date(year, 0, 1).toISOString().split('T')[0],
        end: new Date(year, 11, 31).toISOString().split('T')[0]
      };
    default:
      return null;
  }
};

export default function DateFilterPreset({ onDateChange, storageKey = 'date_filter', defaultPreset = 'this_month' }) {
  const [activePreset, setActivePreset] = useState(defaultPreset);
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    // Load saved preset from localStorage
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const { preset, start, end } = JSON.parse(saved);
      setActivePreset(preset);
      if (preset === 'custom') {
        setCustomStart(start);
        setCustomEnd(end);
        setShowCustom(true);
        onDateChange(start, end);
      } else {
        const range = getDateRange(preset);
        if (range) onDateChange(range.start, range.end);
      }
    } else {
      // Apply default preset
      const range = getDateRange(defaultPreset);
      if (range) onDateChange(range.start, range.end);
    }
  }, []);

  const handlePresetClick = (preset) => {
    setActivePreset(preset);
    setShowCustom(false);
    const range = getDateRange(preset);
    if (range) {
      onDateChange(range.start, range.end);
      localStorage.setItem(storageKey, JSON.stringify({ preset, start: range.start, end: range.end }));
    }
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      setActivePreset('custom');
      onDateChange(customStart, customEnd);
      localStorage.setItem(storageKey, JSON.stringify({ preset: 'custom', start: customStart, end: customEnd }));
    }
  };

  const presets = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'this_week', label: 'This Week' },
    { key: 'last_week', label: 'Last Week' },
    { key: 'this_month', label: 'This Month' },
    { key: 'last_month', label: 'Last Month' },
    { key: 'quarterly', label: 'Quarterly' },
    { key: 'yearly', label: 'Yearly' }
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {presets.map(p => (
          <button
            key={p.key}
            onClick={() => handlePresetClick(p.key)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
            style={{
              background: activePreset === p.key ? '#0F2D5C' : '#F7F9FB',
              color: activePreset === p.key ? '#FFFFFF' : '#434655'
            }}>
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
          style={{
            background: activePreset === 'custom' ? '#0F2D5C' : '#F7F9FB',
            color: activePreset === 'custom' ? '#FFFFFF' : '#434655'
          }}>
          <Calendar size={14} /> Custom
        </button>
      </div>

      {showCustom && (
        <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: '#F7F9FB' }}>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1"
            style={{ borderColor: '#CBD5E1' }}
          />
          <span className="text-xs" style={{ color: '#434655' }}>to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1"
            style={{ borderColor: '#CBD5E1' }}
          />
          <button
            onClick={handleCustomApply}
            className="px-3 py-1 text-xs font-medium rounded-lg text-white"
            style={{ background: '#0E7490' }}>
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
