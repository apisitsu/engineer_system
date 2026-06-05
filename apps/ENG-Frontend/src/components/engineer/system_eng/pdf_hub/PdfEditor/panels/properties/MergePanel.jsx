import React from 'react';
import { Button, Typography } from 'antd';
import { MergeCellsOutlined } from '@ant-design/icons';
import { useTheme } from '../../../../../../../theme';
import { SectionTitle, PropRow } from './SharedProperties';

const { Text } = Typography;

export default function MergePanel({ mergeFiles, mergeLoading, onMerge }) {
    const { theme } = useTheme();
    const totalMergePages = mergeFiles?.length || 0;

    return (
        <div className="pdf-ws-right-panel" style={{
            '--ws-border': theme.colors.border,
            '--ws-surface': theme.colors.surface,
        }}>
            <div className="pdf-ws-right-header">
                <h4 style={{ color: theme.colors.textPrimary }}>
                    <MergeCellsOutlined style={{ marginRight: 8 }} />
                    Merge Options
                </h4>
            </div>
            <div className="pdf-ws-right-body kb-vscroll">
                <div className="pdf-ws-prop-section">
                    <SectionTitle>Summary</SectionTitle>
                    <PropRow label="Files">
                        <Text style={{ fontSize: 12, fontWeight: 600 }}>{totalMergePages}</Text>
                    </PropRow>
                </div>

                <div style={{ marginTop: 16 }}>
                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary, display: 'block', marginBottom: 12 }}>
                        After merging, the result will load into the editor so you can annotate, sign, or export immediately.
                    </Text>
                    <Button
                        type="primary" block size="large"
                        icon={<MergeCellsOutlined />}
                        onClick={onMerge}
                        loading={mergeLoading}
                        disabled={totalMergePages < 2}
                        style={{ borderRadius: 10, height: 44, fontWeight: 600 }}
                    >
                        Merge {totalMergePages} Files
                    </Button>
                </div>
            </div>
        </div>
    );
}
