import React, { useState } from 'react';
import { DndContext, DragOverlay, closestCorners, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import Column from './Column';
import TaskCard from './TaskCard';

const KanbanBoard = ({ tasks, setTasks, onUpdateTasks }) => {
    const [activeId, setActiveId] = useState(null);
    const [dragStartStatus, setDragStartStatus] = useState(null); // Track original status

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    const columns = {
        todo: tasks.filter(t => t.status === 'todo').sort(sortByPriority),
        in_progress: tasks.filter(t => t.status === 'in_progress').sort(sortByPriority),
        check: tasks.filter(t => t.status === 'check').sort(sortByPriority),
        done: tasks.filter(t => t.status === 'done').sort(sortByPriority),
    };

    // Priority sorting function: High > Medium > Low, then by position
    function sortByPriority(a, b) {
        const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
        const aPriority = priorityOrder[a.priority || 'low'];
        const bPriority = priorityOrder[b.priority || 'low'];

        if (aPriority !== bPriority) {
            return aPriority - bPriority; // Higher priority first
        }
        return a.position - b.position; // Same priority, sort by position
    }

    // Log sorting results
    // console.log('🎨 KanbanBoard rendering:', {
    //     total_tasks: tasks.length,
    //     todo: columns.todo.map(t => ({ title: t.title, priority: t.priority, pos: t.position })),
    //     in_progress: columns.in_progress.map(t => ({ title: t.title, priority: t.priority, pos: t.position })),
    //     done: columns.done.map(t => ({ title: t.title, priority: t.priority, pos: t.position }))
    // });

    const findContainer = (id) => {
        if (id in columns) return id;
        const task = tasks.find(t => t.id === id);
        return task ? task.status : null;
    };

    const handleDragStart = (event) => {
        const task = tasks.find(t => t.id === event.active.id);
        setDragStartStatus(task?.status || null); // Store original status
        setActiveId(event.active.id);
        // console.log('🎯 Drag started - Original status:', task?.status);
    };

    const handleDragOver = (event) => {
        const { active, over } = event;
        const overId = over?.id;

        if (!overId || active.id === overId) return;

        const activeContainer = findContainer(active.id);
        const overContainer = findContainer(overId);

        if (!activeContainer || !overContainer || activeContainer === overContainer) {
            return;
        }

        setTasks((prev) => {
            const activeItems = prev.filter(t => t.status === activeContainer);
            const overItems = prev.filter(t => t.status === overContainer);
            const activeIndex = activeItems.findIndex(t => t.id === active.id);
            const overIndex = overItems.findIndex(t => t.id === overId);

            let newIndex;
            if (overId in columns) {
                newIndex = overItems.length + 1;
            } else {
                const isBelowOverItem =
                    over &&
                    active.rect.current.translated &&
                    active.rect.current.translated.top > over.rect.top + over.rect.height;

                const modifier = isBelowOverItem ? 1 : 0;
                newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
            }

            return prev.map(t => {
                if (t.id === active.id) {
                    return { ...t, status: overContainer };
                }
                return t;
            });
        });
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (!over) {
            setActiveId(null);
            setDragStartStatus(null);
            return;
        }

        const activeTask = tasks.find(t => t.id === active.id);
        const overContainer = findContainer(over.id);

        if (!activeTask || !overContainer) {
            setActiveId(null);
            setDragStartStatus(null);
            return;
        }

        const destTasks = tasks.filter(t => t.status === overContainer);
        const isAlreadyInDest = destTasks.some(t => t.id === active.id);

        let updatedDestTasks;

        if (isAlreadyInDest) {
            // Reordering within same column
            const oldIndex = destTasks.findIndex(t => t.id === active.id);
            let newIndex = destTasks.findIndex(t => t.id === over.id);

            if (newIndex === -1) {
                newIndex = destTasks.length - 1;
            }

            updatedDestTasks = arrayMove(destTasks, oldIndex, newIndex);
        } else {
            // Moving to new column
            let newIndex = destTasks.findIndex(t => t.id === over.id);
            if (newIndex === -1) newIndex = destTasks.length;

            const updatedTask = { ...activeTask, status: overContainer };
            updatedDestTasks = [...destTasks];
            updatedDestTasks.splice(newIndex, 0, updatedTask);
        }

        // Apply auto-date logic AFTER determining position
        // Check if status actually changed from original
        const statusChanged = dragStartStatus && dragStartStatus !== overContainer;

        // console.log('🔍 Auto-date check:');
        // console.log('  - Original status:', dragStartStatus);
        // console.log('  - New status:', overContainer);
        // console.log('  - Status changed?', statusChanged);
        // console.log('  - Task:', activeTask.title);
        // console.log('  - is_manual_start:', activeTask.is_manual_start);
        // console.log('  - is_manual_finish:', activeTask.is_manual_finish);

        updatedDestTasks = updatedDestTasks.map(t => {
            if (t.id === activeTask.id && statusChanged) {
                const now = new Date().toISOString();
                let updates = {};

                // Moving TO in_progress -> set start_date
                if (overContainer === 'in_progress' && !activeTask.is_manual_start) {
                    updates.start_date = now;
                }

                // Moving TO check -> set checked_date
                if (overContainer === 'check') {
                    updates.checked_date = now;
                }

                // Moving TO done -> set finished_date
                if (overContainer === 'done' && !activeTask.is_manual_finish) {
                    updates.finished_date = now;
                }

                return { ...t, ...updates };
            }
            return t;
        });

        const finalTasks = updatedDestTasks.map((t, i) => ({ ...t, position: i }));

        // Merge updated tasks back into main list
        const newTasks = tasks.map(t => {
            const found = finalTasks.find(u => u.id === t.id);
            return found || t;
        });

        // console.log('📤 Sending to backend:', finalTasks.map(t => ({
        //     id: t.id,
        //     title: t.title,
        //     status: t.status,
        //     position: t.position,
        //     start_date: t.start_date,
        //     finished_date: t.finished_date
        // })));

        setTasks(newTasks);
        onUpdateTasks(finalTasks);
        setActiveId(null);
        setDragStartStatus(null);
    };

    const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div style={{ display: 'flex', overflowX: 'auto', height: '100%', paddingBottom: 16, alignItems: 'stretch' }}>
                {['todo', 'in_progress', 'check', 'done'].map(status => {
                    const titleMap = { todo: 'To Do', in_progress: 'In Progress', check: '🔍 Review', done: 'Done' };
                    return (
                        <Column
                            key={status}
                            id={status}
                            title={titleMap[status]}
                            tasks={columns[status]}
                            onEdit={(task) => onUpdateTasks(task, 'edit')}
                            onDelete={(id) => onUpdateTasks({ id }, 'delete')}
                        />
                    );
                })}
            </div>
            <DragOverlay>
                {activeTask ? <TaskCard task={activeTask} /> : null}
            </DragOverlay>
        </DndContext>
    );
};

export default KanbanBoard;
