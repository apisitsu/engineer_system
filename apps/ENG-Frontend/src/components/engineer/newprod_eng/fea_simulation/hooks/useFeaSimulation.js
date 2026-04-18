import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:2005';

export default function useFeaSimulation() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [progressMessage, setProgressMessage] = useState('');
  const [simulationResult, setSimulationResult] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  // Poll for job status when jobId is set
  useEffect(() => {
    if (!jobId) return;

    const pollStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_BASE_URL}/api/fea/status/${jobId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const { state, progress, result, failedReason } = res.data;

        // Update progress message
        if (progress && typeof progress === 'string') {
          setProgressMessage(progress);
        }

        if (state === 'completed' && result) {
          setIsSimulating(false);
          setProgressMessage('Downloading results...');
          clearInterval(pollRef.current);
          pollRef.current = null;

          // Fetch the full result file
          const resultRes = await axios.get(`${API_BASE_URL}${result.resultFile}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          setSimulationResult(resultRes.data);
          setProgressMessage('Simulation Complete!');
        } else if (state === 'failed') {
          setIsSimulating(false);
          setError(failedReason || 'Simulation failed');
          setProgressMessage('Simulation Failed.');
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        // For 'active', 'waiting', 'delayed' — keep polling
      } catch (err) {
        console.error('Poll error:', err);
        // Don't stop polling on transient errors
      }
    };

    // Start polling every 1.5 seconds
    pollRef.current = setInterval(pollStatus, 1500);
    // Also do an immediate check
    pollStatus();

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [jobId]);

  const startSimulation = async (csvData) => {
    setIsSimulating(true);
    setJobId(null);
    setSimulationResult(null);
    setError(null);
    setProgressMessage('Submitting job to queue...');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/api/fea/simulate`, csvData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        setJobId(response.data.jobId);
        setProgressMessage('Job queued. Waiting for solver...');
      } else {
        throw new Error(response.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to start simulation');
      setIsSimulating(false);
    }
  };

  return {
    isSimulating,
    progressMessage,
    simulationResult,
    error,
    startSimulation
  };
}
