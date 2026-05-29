/**
 * kanbanRoutes.js
 * All Kanban API routes, mounted at /api/kanban
 */
const router = require('express-promise-router')();

const Project = require('./kanban_project');
const Board = require('./kanban_board');
const Card = require('./kanban_card');
const Extra = require('./kanban_extra');
const Issue = require('./kanban_issue');
const Workload = require('./kanban_workload');
const Settings = require('./kanban_settings');
const Template = require('./kanban_template');

// ─── PROJECT ROUTES ────────────────────────────────────────────────
router.get('/users', Project.GetUsers);
router.get('/projects', Project.GetProjects);
router.post('/projects', Project.CreateProject);
router.get('/projects/:id', Project.GetProjectById);
router.patch('/projects/:id', Project.UpdateProject);
router.delete('/projects/:id', Project.DeleteProject);
router.post('/projects/:id/favorite', Project.ToggleFavorite);
router.get('/projects/:id/managers', Project.GetManagers);
router.post('/projects/:id/managers', Project.AddManager);
router.delete('/projects/:id/managers', Project.RemoveManager);
router.get('/projects/:id/report-data', Project.GetReportData);

// ─── WORKLOAD ROUTES ─────────────
router.get('/workload/team-workload', Workload.GetTeamWorkload);

// ─── ADMIN SETTINGS ────────────────────────────────────────────────
router.get('/settings', Settings.GetSettings);
router.patch('/settings', Settings.checkAdminRole, Settings.UpdateSettings);

// ─── TEMPLATE ROUTES (Blueprint & Selective Cloning) ───────────────
router.get('/templates', Template.GetTemplates);
router.get('/templates/:id', Template.GetTemplateById);
router.post('/templates', Template.CreateTemplate);
router.patch('/templates/:id', Template.UpdateTemplate);
router.delete('/templates/:id', Template.DeleteTemplate);
router.post('/templates/:id/instantiate', Template.InstantiateTemplate);
router.post('/templates/:id/stamp-card', Template.StampCard);
router.post('/templates/:id/stamp-list', Template.StampList);
router.post('/templates/:id/stamp-checklist', Template.StampChecklist);
router.post('/templates/:id/stamp-labels', Template.StampLabels);
router.post('/templates/:id/stamp-board-data', Template.StampBoardData);

// ─── BOARD ROUTES ──────────────────────────────────────────────────
router.get('/projects/:projectId/boards', Board.GetBoards);
router.post('/projects/:projectId/boards', Board.CreateBoard);
router.get('/boards/:id', Board.GetBoard);
router.patch('/boards/:id', Board.UpdateBoard);
router.delete('/boards/:id', Board.DeleteBoard);
router.post('/boards/:id/save-as-blueprint', Board.SaveBoardAsBlueprint);
router.get('/boards/:id/members', Board.GetBoardMembers);
router.post('/boards/:id/members', Board.AddBoardMember);
router.delete('/boards/:id/members', Board.RemoveBoardMember);
router.post('/boards/:id/subscription', Board.ToggleBoardSubscription);

// ─── LIST ROUTES ───────────────────────────────────────────────────
router.get('/boards/:boardId/lists', Board.GetLists);
router.post('/boards/:boardId/lists', Board.CreateList);
router.patch('/lists/:id', Board.UpdateList);
router.delete('/lists/:id', Board.DeleteList);
router.patch('/boards/:boardId/lists/reorder', Board.ReorderLists);
router.post('/lists/:id/sort', Board.SortListCards);

// ─── LABEL ROUTES ──────────────────────────────────────────────────
router.get('/boards/:boardId/labels', Board.GetLabels);
router.post('/boards/:boardId/labels', Board.CreateLabel);
router.patch('/labels/:id', Board.UpdateLabel);
router.delete('/labels/:id', Board.DeleteLabel);

// ─── CARD ROUTES ───────────────────────────────────────────────────
router.get('/lists/:listId/cards', Card.GetCards);
router.post('/lists/:listId/cards', Card.CreateCard);
router.get('/cards/:id', Card.GetCard);
router.patch('/cards/:id', Card.UpdateCard);
router.delete('/cards/:id', Card.DeleteCard);
router.patch('/cards/:id/reorder', Card.ReorderCard);
router.post('/cards/:id/duplicate', Card.DuplicateCard);
router.get('/cards/:id/actions', Card.GetActions);

// Card Memberships
router.post('/cards/:id/memberships', Card.AddCardMember);
router.delete('/cards/:id/memberships', Card.RemoveCardMember);

// Card Labels
router.post('/cards/:id/labels', Card.AddCardLabel);
router.delete('/cards/:id/labels/:labelId', Card.RemoveCardLabel);

// Card Cover
router.patch('/cards/:id/cover', Card.SetCoverImage);

// ─── TASK LISTS & TASKS ────────────────────────────────────────────
router.get('/cards/:id/task-lists', Card.GetTaskLists);
router.post('/cards/:id/task-lists', Card.CreateTaskList);
router.patch('/task-lists/:id', Card.UpdateTaskList);
router.delete('/task-lists/:id', Card.DeleteTaskList);
router.post('/task-lists/:id/tasks', Card.CreateTask);

router.patch('/tasks/:id', Card.UpdateTask);
router.delete('/tasks/:id', Card.DeleteTask);

// ─── COMMENTS ──────────────────────────────────────────────────────
router.post('/cards/:id/comments', Card.AddComment);
router.patch('/comments/:id', Card.UpdateComment);
router.delete('/comments/:id', Card.DeleteComment);

// ─── ATTACHMENTS ───────────────────────────────────────────────────
router.post('/cards/:id/attachments', Card.UploadAttachment);
router.patch('/attachments/:id', Card.UpdateAttachment);
router.delete('/attachments/:id', Card.DeleteAttachment);

// ─── CARD ISSUES ───────────────────────────────────────────────────
router.get('/cards/:cardId/issues', Issue.getCardIssues);
router.post('/cards/:cardId/issues', Issue.createCardIssue);
router.patch('/issues/:issueId', Issue.updateCardIssue);
router.delete('/issues/:issueId', Issue.deleteCardIssue);

// ─── NOTIFICATIONS ─────────────────────────────────────────────────
router.get('/notifications', Card.GetNotifications);
router.patch('/notifications/read-all', Card.MarkAllRead);
router.patch('/notifications/:id/read', Card.MarkRead);

// ─── USER PREFERENCES ──────────────────────────────────────────────
router.get('/user-preferences', Board.GetUserPreferences);
router.patch('/user-preferences', Board.UpdateUserPreferences);

// ─── CUSTOM FIELDS (Feature 12) ────────────────────────────────────
// Base group (project-level templates)
router.get('/projects/:projectId/custom-field-groups', Extra.GetBaseCustomFieldGroups);
router.post('/projects/:projectId/custom-field-groups', Extra.CreateBaseCustomFieldGroup);
router.patch('/base-custom-field-groups/:id', Extra.UpdateBaseCustomFieldGroup);
router.delete('/base-custom-field-groups/:id', Extra.DeleteBaseCustomFieldGroup);
// Board-level groups
router.get('/boards/:boardId/custom-field-groups', Extra.GetCustomFieldGroups);
router.post('/boards/:boardId/custom-field-groups', Extra.CreateCustomFieldGroup);
router.patch('/custom-field-groups/:id', Extra.UpdateCustomFieldGroup);
router.delete('/custom-field-groups/:id', Extra.DeleteCustomFieldGroup);
// Custom fields
router.get('/base-custom-field-groups/:groupId/custom-fields', Extra.GetCustomFields);
router.post('/base-custom-field-groups/:groupId/custom-fields', Extra.CreateCustomField);
router.patch('/custom-fields/:id', Extra.UpdateCustomField);
router.delete('/custom-fields/:id', Extra.DeleteCustomField);
// Custom field values (per card)
router.get('/cards/:cardId/custom-field-values', Extra.GetCustomFieldValues);
router.post('/cards/:cardId/custom-field-values', Extra.UpsertCustomFieldValue);

// ─── WEBHOOKS (Feature 13) ────────────────────────────────────────
router.get('/boards/:boardId/webhooks', Extra.GetWebhooks);
router.post('/boards/:boardId/webhooks', Extra.CreateWebhook);
router.patch('/webhooks/:id', Extra.UpdateWebhook);
router.delete('/webhooks/:id', Extra.DeleteWebhook);

// ─── NOTIFICATION SERVICE (Feature 11) ─────────────────────────────
router.get('/notification-services', Extra.GetNotificationServices);
router.post('/notification-services', Extra.CreateNotificationService);
router.patch('/notification-services/:id', Extra.UpdateNotificationService);
router.delete('/notification-services/:id', Extra.DeleteNotificationService);

// ─── BACKGROUND IMAGES (Feature 10) ───────────────────────────────
router.get('/projects/:projectId/background-images', Extra.GetBackgroundImages);
router.post('/projects/:projectId/background-images', Extra.UploadBackgroundImage);
router.delete('/background-images/:id', Extra.DeleteBackgroundImage);

// ─── STORAGE ──────────────────────────────────────────────────────
router.get('/storage-usage', Extra.GetStorageUsage);

module.exports = router;

