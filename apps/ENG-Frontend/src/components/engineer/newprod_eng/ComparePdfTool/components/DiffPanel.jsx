import React, { memo, useCallback } from 'react';
import { useCompare } from '../context/CompareContext';

export default function DiffPanel() {
  const { state, dispatch } = useCompare();
  const { review } = state;
  const { diffs, filter, selectedDiffId } = review;

  // Compute counts
  const counts = {
    all: diffs.length,
    pending: diffs.filter(d => d.status === 'pending').length,
    resolved: diffs.filter(d => d.status === 'resolved').length,
    ignored: diffs.filter(d => d.status === 'ignored').length,
  };

  // Filter diffs
  const filteredDiffs = filter === 'all'
    ? diffs
    : diffs.filter(d => d.status === filter);

  // Progress
  const resolvedCount = counts.resolved;
  const totalCount = counts.all;
  const progressPercent = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;

  const handleSelectDiff = useCallback((diffId) => {
    dispatch({ type: 'SELECT_DIFF', payload: diffId });
  }, [dispatch]);

  const handleStatusChange = useCallback((e, diffId) => {
    e.stopPropagation();
    dispatch({
      type: 'UPDATE_DIFF_STATUS',
      payload: { id: diffId, status: e.target.value },
    });
  }, [dispatch]);

  const handleToggleVisibility = useCallback((e, diffId) => {
    e.stopPropagation();
    dispatch({ type: 'TOGGLE_DIFF_VISIBILITY', payload: diffId });
  }, [dispatch]);

  // eslint-disable-next-line no-unused-vars
  const getDiffTypeInfo = (type) => {
    if (type === 'pixel') return { icon: '🔲', label: 'Pixel', className: 'pixel' };
    if (type === 'text-added') return { icon: '➕', label: 'Added', className: 'text' };
    if (type === 'text-removed') return { icon: '➖', label: 'Removed', className: 'text' };
    if (type === 'text-modified') return { icon: '✏️', label: 'Modified', className: 'text' };
    if (type === 'page-added') return { icon: '📄+', label: 'Page Added', className: 'text' };
    if (type === 'page-removed') return { icon: '📄−', label: 'Page Removed', className: 'pixel' };
    return { icon: '❓', label: 'Unknown', className: 'pixel' };
  };

  return (
    <div className="diff-panel">
      <div className="diff-panel-header">
        <div className="diff-panel-title">Differences</div>

        {/* Progress */}
        <div className="diff-progress">
          <div className="diff-progress-bar">
            <div
              className="diff-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="diff-progress-text">
            {resolvedCount}/{totalCount}
          </span>
        </div>

        {/* Filter Tabs */}
        <div className="diff-filter-tabs">
          {['all', 'pending', 'resolved', 'ignored'].map(f => (
            <button
              key={f}
              className={`diff-filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SET_FILTER', payload: f })}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="tab-count">({counts[f]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Diff List */}
      <div className="diff-list">
        {filteredDiffs.length === 0 ? (
          <div className="diff-list-empty">
            <span className="empty-icon">
              {filter === 'all' ? '✅' : '🔍'}
            </span>
            <span className="empty-text">
              {filter === 'all'
                ? 'No differences found'
                : `No ${filter} differences`}
            </span>
          </div>
        ) : (
          filteredDiffs.map(diff => (
            <DiffItem
              key={diff.id}
              diff={diff}
              isSelected={selectedDiffId === diff.id}
              onSelect={handleSelectDiff}
              onStatusChange={handleStatusChange}
              onToggleVisibility={handleToggleVisibility}
            />
          ))
        )}
      </div>

      {/* Footer Bulk Actions */}
      {diffs.length > 0 && (
        <div className="diff-panel-footer">
          <button
            className="btn btn-sm btn-subtle"
            onClick={() => dispatch({ type: 'BULK_UPDATE_STATUS', payload: { status: 'resolved' } })}
          >
            ✓ Resolve All
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => dispatch({ type: 'BULK_UPDATE_STATUS', payload: { status: 'pending' } })}
          >
            ↻ Reset All
          </button>
        </div>
      )}
    </div>
  );
}

// Extract into memoized component to prevent re-rendering all items when one is clicked
const DiffItem = memo(({ diff, isSelected, onSelect, onStatusChange, onToggleVisibility }) => {
  const getDiffTypeInfo = (type) => {
    if (type === 'pixel') return { icon: '🔲', label: 'Pixel', className: 'pixel' };
    if (type === 'text-added') return { icon: '➕', label: 'Added', className: 'text' };
    if (type === 'text-removed') return { icon: '➖', label: 'Removed', className: 'text' };
    if (type === 'text-modified') return { icon: '✏️', label: 'Modified', className: 'text' };
    if (type === 'page-added') return { icon: '📄+', label: 'Page Added', className: 'text' };
    if (type === 'page-removed') return { icon: '📄−', label: 'Page Removed', className: 'pixel' };
    return { icon: '❓', label: 'Unknown', className: 'pixel' };
  };

  const typeInfo = getDiffTypeInfo(diff.type);

  return (
    <div
      className={`diff-item ${isSelected ? 'selected' : ''} ${!diff.visible ? 'hidden-diff' : ''}`}
      onClick={() => onSelect(diff.id)}
    >
      <div className="diff-item-header">
        <div className={`diff-item-type ${typeInfo.className}`}>
          <span className="type-icon">{typeInfo.icon}</span>
          <span className="type-label">{typeInfo.label}</span>
        </div>
        <div className="diff-item-actions">
          <button
            className="btn-icon btn-ghost visibility-toggle"
            onClick={(e) => onToggleVisibility(e, diff.id)}
            title={diff.visible ? 'Hide bounding box' : 'Show bounding box'}
          >
            {diff.visible ? '👁️' : '👁️‍🗨️'}
          </button>
          <span className="diff-item-page">Page {diff.page}</span>
        </div>
      </div>

      <div className="diff-item-description">
        {diff.description}
      </div>

      <div className="diff-item-footer">
        <span className={`status-badge ${diff.status}`}>
          {diff.status === 'pending' && '⏳'}
          {diff.status === 'resolved' && '✓'}
          {diff.status === 'ignored' && '—'}
          {' '}{diff.status}
        </span>
        <select
          className="status-select"
          value={diff.status}
          onChange={(e) => onStatusChange(e, diff.id)}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="ignored">Ignored</option>
        </select>
      </div>
    </div>
  );
});
