import moment from 'moment';
import { ECNT_STAGES, STAGE_MAP } from './ecntConstants';

/**
 * Transforms historical stage records and current document status into a Gantt Chart dataset
 * with Actual stages (Past), Active stage (Current), Return Loops (Rework), and Projected stages (Future).
 */
export const buildDocumentGanttData = (doc, stageHistory = []) => {
    if (!doc) return { stages: [], totalHours: 0, projectedFinish: null };

    const createdAt = moment(doc.created_at || new Date());
    let runningTime = moment(createdAt);
    const resultStages = [];

    // 1. Process Actual Historical & Active Stages
    const visitedStageCodes = new Set();

    if (Array.isArray(stageHistory) && stageHistory.length > 0) {
        stageHistory.forEach((hist, idx) => {
            const meta = STAGE_MAP[hist.stage_code] || {
                title: hist.stage_title || hist.stage_code,
                shortTitle: hist.stage_code,
                color: hist.status === 'RETURNED' ? '#fa8c16' : '#1890ff',
                slaHours: 24,
                type: hist.stage_type || 'STANDARD'
            };

            const start = moment(hist.started_at || runningTime);
            const end = hist.completed_at ? moment(hist.completed_at) : moment();
            const duration = hist.duration_hours ? Number(hist.duration_hours) : Math.max(0.5, Number((end.diff(start, 'hours', true)).toFixed(1)));

            visitedStageCodes.add(hist.stage_code);
            runningTime = moment(end);

            resultStages.push({
                id: `actual_${hist.id || idx}`,
                stageCode: hist.stage_code,
                title: hist.stage_title || meta.title,
                shortTitle: meta.shortTitle,
                picRole: hist.assigned_role || meta.picRole,
                picName: hist.assigned_pic || hist.action_by_name || meta.picName,
                start: start.toDate(),
                end: end.toDate(),
                durationHours: duration,
                status: hist.status || 'COMPLETED', // COMPLETED | ACTIVE | RETURNED
                isReturnLoop: hist.stage_type === 'RETURN_LOOP' || (hist.stage_code || '').includes('_R'),
                isProjected: false,
                color: hist.status === 'RETURNED' ? '#fa8c16' : (hist.status === 'ACTIVE' ? '#1890ff' : '#52c41a'),
                actionTaken: hist.action_taken,
                actionBy: hist.action_by_name,
                notes: hist.notes
            });
        });
    }

    // 2. If document is not terminal (Closed / Denied / Effective), project future stages
    const isDocClosed = ['ECR Only Closed', 'ECN Effective', 'Denied'].includes(doc.process_status);

    if (!isDocClosed) {
        // Find remaining standard stages
        const currentStageCode = doc.current_stage_code || (doc.doc_type === 'ECN' ? 'STAGE_5' : 'STAGE_2');
        const currentStageIdx = ECNT_STAGES.findIndex(s => s.code === currentStageCode);

        // All standard stages following the current active stage
        const remainingStages = ECNT_STAGES.filter((s, idx) => {
            if (s.type === 'RETURN_LOOP') return false; // Don't project speculative future rework
            if (currentStageIdx >= 0 && idx <= currentStageIdx) return false;
            // If document is ECR and doesn't issue ECN, don't project ECN stages
            if (doc.doc_type === 'ECR' && doc.process_status === 'ECR Only Closed') return false;
            return true;
        });

        let projectedCursor = moment(runningTime);

        remainingStages.forEach((meta) => {
            const start = moment(projectedCursor);
            const slaDuration = meta.slaHours || 24;
            const end = moment(start).add(slaDuration, 'hours');
            projectedCursor = moment(end);

            resultStages.push({
                id: `projected_${meta.code}`,
                stageCode: meta.code,
                title: `[Projected] ${meta.title}`,
                shortTitle: meta.shortTitle,
                picRole: meta.picRole,
                picName: meta.picName,
                start: start.toDate(),
                end: end.toDate(),
                durationHours: slaDuration,
                status: 'PROJECTED',
                isReturnLoop: false,
                isProjected: true,
                color: '#8c8c8c',
                notes: `Standard SLA: ${slaDuration} hrs`
            });
        });
    }

    // Calculate total duration from earliest start to latest end
    const totalHours = resultStages.reduce((acc, s) => acc + s.durationHours, 0);
    const projectedFinish = resultStages.length > 0 ? resultStages[resultStages.length - 1].end : null;

    return {
        stages: resultStages,
        totalHours: Number(totalHours.toFixed(1)),
        projectedFinish
    };
};
