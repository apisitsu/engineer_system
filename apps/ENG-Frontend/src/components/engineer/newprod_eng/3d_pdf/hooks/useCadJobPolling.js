/**
 * useCadJobPolling — React Hook for CAD Job Status Polling
 * 
 * Polls the backend API every 2 seconds while the job is in-progress.
 * Auto-stops on COMPLETED or FAILED.
 * Includes WebSocket upgrade path for real-time updates.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:2005';
const POLL_INTERVAL = 2000; // 2 seconds

/**
 * @param {string} jobId - BullMQ job ID to track
 * @param {Object} options - { enabled: true, onComplete, onFail }
 */
export default function useCadJobPolling(jobId, options = {}) {
  const { enabled = true, onComplete, onFail } = options;

  const [status, setStatus] = useState(null);      // PENDING | PROCESSING | COMPLETED | FAILED
  const [progress, setProgress] = useState('');      // Latest progress message
  const [result, setResult] = useState(null);        // Job result data (files, paths)
  const [error, setError] = useState(null);          // Error message
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef(null);
  const hasNotified = useRef(false);

  // Reset notification flag when jobId changes
  useEffect(() => {
    hasNotified.current = false;
  }, [jobId]);

  const fetchStatus = useCallback(async () => {
    if (!jobId) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/api/cad/status/${jobId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (response.data.success) {
        const jobData = response.data.job || {};
        const bullmqData = response.data.bullmq || {};

        const currentStatus = jobData.status || 
          (bullmqData.state === 'completed' ? 'COMPLETED' :
           bullmqData.state === 'failed' ? 'FAILED' :
           bullmqData.state === 'active' ? 'PROCESSING' :
           'PENDING');

        setStatus(currentStatus);
        setProgress(jobData.progress_message || bullmqData.progress || '');

        if (currentStatus === 'COMPLETED') {
          setResult(jobData);
          setError(null);
          if (!hasNotified.current) {
            hasNotified.current = true;
            onComplete?.(jobData);
          }
        } else if (currentStatus === 'FAILED') {
          setError(jobData.error_message || 'Job failed');
          if (!hasNotified.current) {
            hasNotified.current = true;
            onFail?.(jobData.error_message);
          }
        }
      }
    } catch (err) {
      console.error('[CadJobPolling] Error:', err.message);
      // Don't set error for network issues during polling — keep trying
    }
  }, [jobId, onComplete, onFail]);

  // Start/stop polling based on status
  useEffect(() => {
    if (!jobId || !enabled) return;

    setIsLoading(true);
    setError(null);

    // Initial fetch
    fetchStatus();

    // Start polling
    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobId, enabled, fetchStatus]);

  // Auto-stop polling when job is done
  useEffect(() => {
    if (status === 'COMPLETED' || status === 'FAILED') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsLoading(false);
    }
  }, [status]);

  // Manual refetch
  const refetch = useCallback(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Reset
  const reset = useCallback(() => {
    setStatus(null);
    setProgress('');
    setResult(null);
    setError(null);
    setIsLoading(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return {
    status,
    progress,
    result,
    error,
    isLoading,
    refetch,
    reset,
    isPolling: !!intervalRef.current
  };
}
