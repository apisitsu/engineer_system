import React, { memo, useCallback, useEffect } from 'react';
import { useCompare } from '../context/CompareContext';

export default function DiffPanel() {
  const { state, dispatch } = useCompare();
  const { review, viewer } = state;
  const { diffs, filter, selectedDiffId, searchQuery, scope } = review;
  const { currentPage } = viewer;

  // Filter by scope (current page vs all)
  const scopedDiffs = scope === 'current-page'
    ? diffs.filter(d => d.page === currentPage)
    : diffs;

  // Filter by search query
  const searchedDiffs = searchQuery.trim()
    ? scopedDiffs.filter(d =>
        (d.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.textOld || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.textNew || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : scopedDiffs;

  // Filter by status tab
  const filteredDiffs = filter === 'all'
    ? searchedDiffs
    : searchedDiffs.filter(d => d.status === filter);

  // Compute counts based on current scope
  const counts = {
    all: scopedDiffs.length,
    pending: scopedDiffs.filter(d => d.status === 'pending').length,
    resolved: scopedDiffs.filter(d => d.status === 'resolved').length,
    ignored: scopedDiffs.filter(d => d.status === 'ignored').length,
  };

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

  // Keyboard navigation: J (next), K (prev), Space (toggle resolved), [ / ] (page)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const curIdx = filteredDiffs.findIndex(d => d.id === selectedDiffId);
        const nextDiff = filteredDiffs[curIdx + 1] || filteredDiffs[0];
        if (nextDiff) dispatch({ type: 'SELECT_DIFF', payload: nextDiff.id });
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const curIdx = filteredDiffs.findIndex(d => d.id === selectedDiffId);
        const prevDiff = filteredDiffs[curIdx - 1] || filteredDiffs[filteredDiffs.length - 1];
        if (prevDiff) dispatch({ type: 'SELECT_DIFF', payload: prevDiff.id });
      } else if (e.key === ' ') {
        e.preventDefault();
        if (selectedDiffId) {
          const diff = diffs.find(d => d.id === selectedDiffId);
          if (diff) {
            const nextStatus = diff.status === 'resolved' ? 'pending' : 'resolved';
            dispatch({ type: 'UPDATE_DIFF_STATUS', payload: { id: selectedDiffId, status: nextStatus } });
          }
        }
      } else if (e.key === '[') {
        dispatch({ type: 'SET_PAGE', payload: currentPage - 1 });
      } else if (e.key === ']') {
        dispatch({ type: 'SET_PAGE', payload: currentPage + 1 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredDiffs, selectedDiffId, diffs, currentPage, dispatch]);

  return (
    <div className="diff-panel">
      <div className="diff-panel-header">
        <div className="diff-panel-title">Differences Review</div>

        {/* Scope and Search Bar */}
        <div className="diff-filter-bar">
          <div className="diff-scope-toggle">
            <button
              className={`diff-scope-btn ${scope === 'all' ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SET_REVIEW_SCOPE', payload: 'all' })}
            >
              All Pages ({diffs.length})
            </button>
            <button
              className={`diff-scope-btn ${scope === 'current-page' ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SET_REVIEW_SCOPE', payload: 'current-page' })}
            >
              Page {currentPage} ({diffs.filter(d => d.page === currentPage).length})
            </button>
          </div>

          <input
            type="text"
            className="diff-search-input"
            placeholder="Search differences..."
            value={searchQuery}
            onChange={(e) => dispatch({ type: 'SET_REVIEW_SEARCH', payload: e.target.value })}
          />
        </div>

        {/* Progress */}
        <div className="diff-progress">
          <div className="diff-progress-bar">
            <div
              className="diff-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="diff-progress-text">
            {resolvedCount}/{totalCount} ({progressPercent}%)
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
                ? (scope === 'current-page' ? `No differences on Page ${currentPage}` : 'No differences found')
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
      {scopedDiffs.length > 0 && (
        <div className="diff-panel-footer">
          <button
            className="btn btn-sm btn-subtle"
            onClick={() => dispatch({
              type: 'BULK_UPDATE_STATUS',
              payload: {
                status: 'resolved',
                page: scope === 'current-page' ? currentPage : null
              }
            })}
            title={scope === 'current-page' ? `Resolve all on Page ${currentPage}` : 'Resolve all in document'}
          >
            ✓ {scope === 'current-page' ? `Resolve Page ${currentPage}` : 'Resolve All'}
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => dispatch({
              type: 'BULK_UPDATE_STATUS',
              payload: {
                status: 'pending',
                page: scope === 'current-page' ? currentPage : null
              }
            })}
          >
            ↻ Reset
          </button>
        </div>
      )}
    </div>
  );
}

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

