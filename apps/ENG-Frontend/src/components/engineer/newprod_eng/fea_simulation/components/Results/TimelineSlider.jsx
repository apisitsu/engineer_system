import React from 'react';
import { Slider, Typography } from 'antd';

const { Text } = Typography;

export default function TimelineSlider({ currentTimeStep, maxSteps, onChange }) {
  if (maxSteps <= 0) return null;

  return (
    <div style={{ padding: '16px', background: '#1f1f1f', borderRadius: '8px', marginTop: '16px' }}>
      <Text style={{ color: '#ccc', display: 'block', marginBottom: '8px' }}>
        Simulation Timeline (Step {currentTimeStep} of {maxSteps})
      </Text>
      <Slider
        min={1}
        max={maxSteps}
        value={currentTimeStep}
        onChange={onChange}
        tooltip={{ formatter: (value) => `Step ${value}` }}
        trackStyle={{ backgroundColor: '#1890ff' }}
        handleStyle={{ borderColor: '#1890ff' }}
      />
    </div>
  );
}
